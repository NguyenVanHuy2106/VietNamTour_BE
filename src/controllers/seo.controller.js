const fs = require("fs");

const Tour = require("../models/tours/tour.model");
const TourImage = require("../models/tours/tourImage.model");

const FRONTEND_INDEX = "/var/www/VietNamTour_FE/build/index.html";

const escapeHtml = (value = "") => {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
};

const stripHtml = (value = "") => {
  return String(value)
    .replace(/<[^>]*>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
};

const renderTour = async (req, res) => {
  try {
    const slug = String(req.params.slug || "").trim();

    if (!slug) {
      return res.status(404).sendFile(FRONTEND_INDEX);
    }

    const tour = await Tour.findOne({
      where: {
        slug,
      },
    });

    if (!tour) {
      return res.status(404).sendFile(FRONTEND_INDEX);
    }

    const images = await TourImage.findAll({
      where: {
        tourid: tour.tourid,
      },
    });

    let html = fs.readFileSync(FRONTEND_INDEX, "utf8");

    // =========================
    // TITLE
    // =========================
    const title = tour.tourname || "Tour du lịch | Việt Nam Tour";

    // =========================
    // DESCRIPTION
    // =========================
    let description = stripHtml(tour.description || "");

    if (description.length > 160) {
      description = `${description.substring(0, 157).trim()}...`;
    }

    if (!description) {
      description =
        `${title}. Chương trình tour do Việt Nam Tour tổ chức ` +
        `dành cho khách đoàn, doanh nghiệp, team building và sự kiện.`;
    }

    // =========================
    // CANONICAL
    // =========================
    const canonical = `https://myvietnamtour.vn/tour/${encodeURIComponent(
      tour.slug,
    )}`;

    // =========================
    // IMAGE
    // =========================
    let image = "https://cdn.myvietnamtour.vn/uploads/1.png";

    if (images && images.length > 0) {
      const firstImage = images[0];

      image =
        firstImage.image ||
        firstImage.imageurl ||
        firstImage.url ||
        firstImage.path ||
        image;
    }

    // =========================
    // XÓA CANONICAL CŨ
    // =========================
    html = html.replace(/<link[^>]+rel=["']canonical["'][^>]*>/gi, "");

    // =========================
    // TITLE
    // =========================
    html = html.replace(
      /<title>[\s\S]*?<\/title>/i,
      `<title>${escapeHtml(title)}</title>`,
    );

    // =========================
    // DESCRIPTION
    // =========================
    html = html.replace(
      /<meta\s+name=["']description["'][^>]*>/i,
      `<meta name="description" content="${escapeHtml(description)}"/>`,
    );

    // =========================
    // XÓA OG CŨ
    // =========================
    html = html
      .replace(/<meta\s+property=["']og:title["'][^>]*>/gi, "")
      .replace(/<meta\s+property=["']og:description["'][^>]*>/gi, "")
      .replace(/<meta\s+property=["']og:image["'][^>]*>/gi, "")
      .replace(/<meta\s+property=["']og:url["'][^>]*>/gi, "")
      .replace(/<meta\s+property=["']og:type["'][^>]*>/gi, "");

    // =========================
    // SEO TAGS
    // =========================
    const seoTags = `
<link rel="canonical" href="${canonical}"/>

<meta property="og:type" content="website"/>
<meta property="og:title" content="${escapeHtml(title)}"/>
<meta property="og:description" content="${escapeHtml(description)}"/>
<meta property="og:url" content="${canonical}"/>
<meta property="og:image" content="${escapeHtml(image)}"/>

<meta name="twitter:card" content="summary_large_image"/>
<meta name="twitter:title" content="${escapeHtml(title)}"/>
<meta name="twitter:description" content="${escapeHtml(description)}"/>
<meta name="twitter:image" content="${escapeHtml(image)}"/>
`;

    html = html.replace("</head>", `${seoTags}</head>`);

    return res.status(200).type("html").send(html);
  } catch (error) {
    console.error("SEO TOUR RENDER ERROR:", error);

    return res.status(500).sendFile(FRONTEND_INDEX);
  }
};

const renderTourList = async (req, res) => {
  try {
    let html = fs.readFileSync(FRONTEND_INDEX, "utf8");

    const title = "Danh sách tour du lịch | Việt Nam Tour";

    const description =
      "Khám phá các tour du lịch trong nước, tour khách đoàn doanh nghiệp, team building, MICE và gala dinner do Việt Nam Tour tổ chức.";

    const canonical = "https://myvietnamtour.vn/danh-sach-tour";

    html = html.replace(/<link[^>]+rel=["']canonical["'][^>]*>/gi, "");

    html = html.replace(
      /<title>[\s\S]*?<\/title>/i,
      `<title>${escapeHtml(title)}</title>`,
    );

    html = html.replace(
      /<meta\s+name=["']description["'][^>]*>/i,
      `<meta name="description" content="${escapeHtml(description)}"/>`,
    );

    html = html
      .replace(/<meta\s+property=["']og:title["'][^>]*>/gi, "")
      .replace(/<meta\s+property=["']og:description["'][^>]*>/gi, "")
      .replace(/<meta\s+property=["']og:url["'][^>]*>/gi, "");

    const seoTags = `
<link rel="canonical" href="${canonical}"/>

<meta property="og:title" content="${escapeHtml(title)}"/>
<meta property="og:description" content="${escapeHtml(description)}"/>
<meta property="og:url" content="${canonical}"/>
`;

    html = html.replace("</head>", `${seoTags}</head>`);

    return res.status(200).type("html").send(html);
  } catch (error) {
    console.error("SEO TOUR LIST RENDER ERROR:", error);

    return res.status(500).sendFile(FRONTEND_INDEX);
  }
};

module.exports = {
  renderTour,
  renderTourList,
};
