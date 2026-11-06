const fs = require("fs");
const sanitizeHtml = require("sanitize-html");

const Tour = require("../models/tours/tour.model");
const TourImage = require("../models/tours/tourImage.model");
const Posts = require("../models/posts.model");

const FRONTEND_INDEX = "/var/www/VietNamTour_FE/build/index.html";

const SITE_URL = "https://myvietnamtour.vn";

const DEFAULT_IMAGE = "https://cdn.myvietnamtour.vn/uploads/1.png";

/* =====================================================
   HELPER: ESCAPE HTML
===================================================== */

const escapeHtml = (value = "") => {
  return String(value == null ? "" : value)
    .replace(/&/g, "&amp;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
};

/* =====================================================
   HELPER: LOẠI BỎ HTML ĐỂ LẤY TEXT
===================================================== */

const stripHtml = (value = "") => {
  const clean = sanitizeHtml(String(value == null ? "" : value), {
    allowedTags: [],
    allowedAttributes: {},
  });

  return clean
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/\s+/g, " ")
    .trim();
};

/* =====================================================
   HELPER: META DESCRIPTION
===================================================== */

const makeDescription = (value, fallback, maxLength = 160) => {
  let description = stripHtml(value || "");

  if (!description) {
    description = fallback;
  }

  if (description.length > maxLength) {
    description = description.substring(0, maxLength - 3).trim() + "...";
  }

  return description;
};

/* =====================================================
   HELPER: DATE
===================================================== */

const toISODate = (value) => {
  if (!value) return "";

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "";
  }

  return date.toISOString();
};

/* =====================================================
   HELPER: LẤY HTML REACT
===================================================== */

const getFrontendHtml = () => {
  return fs.readFileSync(FRONTEND_INDEX, "utf8");
};

/* =====================================================
   HELPER: XÓA META CŨ CỦA TRANG
===================================================== */

const cleanSeoHead = (html) => {
  return html
    .replace(/<link\b[^>]*rel=["']canonical["'][^>]*>/gi, "")
    .replace(/<meta\b[^>]*name=["']description["'][^>]*>/gi, "")
    .replace(/<meta\b[^>]*name=["']robots["'][^>]*>/gi, "")
    .replace(
      /<meta\b[^>]*property=["']og:(title|description|image|url|type)["'][^>]*>/gi,
      "",
    )
    .replace(
      /<meta\b[^>]*name=["']twitter:(card|title|description|image)["'][^>]*>/gi,
      "",
    );
};

/* =====================================================
   HELPER: THÊM TITLE VÀ SEO TAGS
===================================================== */

const injectSeoHead = (html, title, seoTags) => {
  let output = cleanSeoHead(html);

  if (/<title\b[^>]*>[\s\S]*?<\/title>/i.test(output)) {
    output = output.replace(
      /<title\b[^>]*>[\s\S]*?<\/title>/i,
      `<title>${escapeHtml(title)}</title>`,
    );
  } else {
    output = output.replace(
      /<\/head>/i,
      `<title>${escapeHtml(title)}</title></head>`,
    );
  }

  output = output.replace(/<\/head>/i, `${seoTags}\n</head>`);

  return output;
};

/* =====================================================
   HELPER: SANITIZE NỘI DUNG BLOG
===================================================== */

const sanitizeBlogContent = (content) => {
  return sanitizeHtml(String(content == null ? "" : content), {
    allowedTags: [
      "p",
      "br",
      "hr",
      "div",
      "span",
      "strong",
      "b",
      "em",
      "i",
      "u",
      "s",
      "h1",
      "h2",
      "h3",
      "h4",
      "h5",
      "h6",
      "ul",
      "ol",
      "li",
      "blockquote",
      "a",
      "img",
      "figure",
      "figcaption",
      "table",
      "thead",
      "tbody",
      "tfoot",
      "tr",
      "th",
      "td",
      "pre",
      "code",
    ],

    allowedAttributes: {
      a: ["href", "title"],
      img: ["src", "alt", "title", "width", "height"],
      td: ["colspan", "rowspan"],
      th: ["colspan", "rowspan", "scope"],
    },

    allowedSchemes: ["http", "https", "mailto"],

    allowProtocolRelative: false,

    // H1 chính là tiêu đề bài viết.
    // Nếu nội dung editor có H1 thì hạ thành H2.
    transformTags: {
      h1: "h2",
    },

    // Không cho phép script, style, iframe.
    disallowedTagsMode: "discard",
  });
};

/* =====================================================
   HELPER: TẠO HTML FALLBACK BLOG
===================================================== */

const buildBlogHtml = (post, canonical) => {
  const title = post.title || "Bản tin du lịch | Việt Nam Tour";

  const intro = stripHtml(post.description || "");

  let content = sanitizeBlogContent(post.content || "");

  if (!stripHtml(content)) {
    content = `<p>${escapeHtml(intro || title)}</p>`;
  }

  const image = post.thumbnail_url || "";

  const publishedTime = toISODate(post.created_at);

  const formattedDate = publishedTime ? publishedTime.substring(0, 10) : "";

  return `
<main class="seo-pre-render">
  <article class="seo-blog-article"
           itemscope
           itemtype="https://schema.org/BlogPosting">

    <nav aria-label="Điều hướng">
      <a href="/">Trang chủ</a>
      <span> / </span>
      <a href="/blog">Cẩm nang du lịch</a>
    </nav>

    <header>
      <h1 itemprop="headline">
        ${escapeHtml(title)}
      </h1>

      ${
        intro
          ? `<p class="seo-blog-intro">
               ${escapeHtml(intro)}
             </p>`
          : ""
      }

      ${
        formattedDate
          ? `<time datetime="${escapeHtml(publishedTime)}">
               ${escapeHtml(formattedDate)}
             </time>`
          : ""
      }

      ${
        image
          ? `<figure>
               <img
                 src="${escapeHtml(image)}"
                 alt="${escapeHtml(title)}"
                 loading="eager"
               />
             </figure>`
          : ""
      }
    </header>

    <div class="seo-blog-content"
         itemprop="articleBody">
      ${content}
    </div>

    <footer>
      <p>
        Biên tập bởi
        <a href="${SITE_URL}/">
          Việt Nam Tour
        </a>
      </p>

      <p>
        <a href="/blog">
          Khám phá thêm cẩm nang du lịch
        </a>
      </p>
    </footer>

  </article>
</main>
`;
};

/* =====================================================
   HELPER: ĐƯA HTML VÀO REACT ROOT
===================================================== */

const injectBlogIntoRoot = (html, blogHtml) => {
  const rootPattern = /<div\b([^>]*\bid\s*=\s*["']root["'][^>]*)>\s*<\/div>/i;

  if (!rootPattern.test(html)) {
    throw new Error("Không tìm thấy React root trống trong index.html");
  }

  return html.replace(rootPattern, (match, attributes) => {
    return `<div${attributes}>` + blogHtml + `</div>`;
  });
};

/* =====================================================
   HELPER: CSS CHO HTML FALLBACK
===================================================== */

const getBlogFallbackStyle = () => {
  return `
<style id="seo-blog-fallback-style">
  .seo-pre-render {
    max-width: 1100px;
    margin: 35px auto;
    padding: 20px;
    color: #243448;
    font-family: Arial, sans-serif;
  }

  .seo-blog-article {
    max-width: 900px;
    margin: 0 auto;
  }

  .seo-pre-render nav {
    margin-bottom: 25px;
    font-size: 13px;
  }

  .seo-pre-render a {
    color: #1d61ad;
  }

  .seo-pre-render h1 {
    color: #172b4d;
    font-size: clamp(28px, 4vw, 42px);
    line-height: 1.3;
  }

  .seo-blog-intro {
    font-size: 17px;
    line-height: 1.8;
    color: #536475;
  }

  .seo-pre-render figure {
    margin: 25px 0;
  }

  .seo-pre-render img {
    max-width: 100%;
    height: auto;
    border-radius: 12px;
  }

  .seo-blog-content {
    margin-top: 25px;
    font-size: 17px;
    line-height: 1.85;
    overflow-wrap: anywhere;
  }

  .seo-blog-content h2,
  .seo-blog-content h3 {
    color: #172b4d;
    margin-top: 30px;
  }

  .seo-blog-content p {
    margin-bottom: 18px;
  }

  .seo-blog-content table {
    max-width: 100%;
    display: block;
    overflow-x: auto;
    border-collapse: collapse;
  }

  .seo-blog-content th,
  .seo-blog-content td {
    border: 1px solid #e5e9ef;
    padding: 8px;
  }

  .seo-blog-article footer {
    margin-top: 35px;
    padding-top: 20px;
    border-top: 1px solid #e5e9ef;
    font-size: 14px;
  }

  @media (max-width: 600px) {
    .seo-pre-render {
      margin: 15px auto;
      padding: 15px;
    }

    .seo-blog-content {
      font-size: 15px;
    }
  }
</style>
`;
};

/* =====================================================
   RENDER TOUR - GIỮ LOGIC CŨ
===================================================== */

const renderTour = async (req, res) => {
  try {
    const slug = String(req.params.slug || "").trim();

    if (!slug) {
      return res.status(404).sendFile(FRONTEND_INDEX);
    }

    const tour = await Tour.findOne({
      where: { slug },
    });

    if (!tour) {
      return res.status(404).sendFile(FRONTEND_INDEX);
    }

    const images = await TourImage.findAll({
      where: {
        tourid: tour.tourid,
      },
    });

    const title = tour.tourname || "Tour du lịch | Việt Nam Tour";

    const description = makeDescription(
      tour.description,
      `${title}. Chương trình tour do Việt Nam Tour tổ chức dành cho khách đoàn, doanh nghiệp, team building và sự kiện.`,
    );

    const canonical = SITE_URL + "/tour/" + encodeURIComponent(tour.slug);

    let image = DEFAULT_IMAGE;

    if (images && images.length > 0) {
      const firstImage = images[0];

      image =
        firstImage.image ||
        firstImage.imageurl ||
        firstImage.url ||
        firstImage.path ||
        DEFAULT_IMAGE;
    }

    const seoTags = `
<meta name="description"
 content="${escapeHtml(description)}"/>

<link rel="canonical"
 href="${escapeHtml(canonical)}"/>

<meta property="og:type" content="website"/>
<meta property="og:title"
 content="${escapeHtml(title)}"/>
<meta property="og:description"
 content="${escapeHtml(description)}"/>
<meta property="og:url"
 content="${escapeHtml(canonical)}"/>
<meta property="og:image"
 content="${escapeHtml(image)}"/>

<meta name="twitter:card"
 content="summary_large_image"/>
<meta name="twitter:title"
 content="${escapeHtml(title)}"/>
<meta name="twitter:description"
 content="${escapeHtml(description)}"/>
<meta name="twitter:image"
 content="${escapeHtml(image)}"/>
`;

    let html = getFrontendHtml();

    html = injectSeoHead(html, title, seoTags);

    return res.status(200).type("html").send(html);
  } catch (error) {
    console.error("SEO TOUR RENDER ERROR:", error);

    return res.status(500).sendFile(FRONTEND_INDEX);
  }
};

/* =====================================================
   RENDER TOUR LIST - GIỮ LOGIC CŨ
===================================================== */

const renderTourList = async (req, res) => {
  try {
    const title = "Danh sách tour du lịch | Việt Nam Tour";

    const description =
      "Khám phá các tour du lịch trong nước, tour khách đoàn doanh nghiệp, team building, MICE và gala dinner do Việt Nam Tour tổ chức.";

    const canonical = SITE_URL + "/danh-sach-tour";

    const seoTags = `
<meta name="description"
 content="${escapeHtml(description)}"/>

<link rel="canonical"
 href="${escapeHtml(canonical)}"/>

<meta property="og:title"
 content="${escapeHtml(title)}"/>
<meta property="og:description"
 content="${escapeHtml(description)}"/>
<meta property="og:url"
 content="${escapeHtml(canonical)}"/>
`;

    let html = getFrontendHtml();

    html = injectSeoHead(html, title, seoTags);

    return res.status(200).type("html").send(html);
  } catch (error) {
    console.error("SEO TOUR LIST RENDER ERROR:", error);

    return res.status(500).sendFile(FRONTEND_INDEX);
  }
};

/* =====================================================
   RENDER BLOG - SERVER HTML FALLBACK
===================================================== */

const renderBlog = async (req, res) => {
  try {
    const slug = String(req.params.slug || "").trim();

    if (!slug) {
      return res.status(404).sendFile(FRONTEND_INDEX);
    }

    // Lấy bài viết thực tế từ database
    const post = await Posts.findOne({
      where: { slug },
    });

    if (!post) {
      return res.status(404).sendFile(FRONTEND_INDEX);
    }

    const title = post.title || "Bản tin du lịch | Việt Nam Tour";

    const description = makeDescription(
      post.description || post.content,
      `${title}. Cẩm nang, kinh nghiệm và thông tin du lịch được cập nhật bởi Việt Nam Tour.`,
    );

    const canonical = SITE_URL + "/blog/" + encodeURIComponent(post.slug);

    const image = post.thumbnail_url || DEFAULT_IMAGE;

    const publishedTime = toISODate(post.created_at);

    const modifiedTime = toISODate(post.updated_at || post.created_at);

    // Schema JSON-LD
    const schema = {
      "@context": "https://schema.org",
      "@type": "BlogPosting",
      "@id": canonical + "#article",
      headline: title,
      description: description,
      image: [image],
      mainEntityOfPage: {
        "@type": "WebPage",
        "@id": canonical,
      },
      author: {
        "@type": "Organization",
        name: "Việt Nam Tour",
        url: SITE_URL + "/",
      },
      publisher: {
        "@type": "Organization",
        name: "Việt Nam Tour",
        url: SITE_URL + "/",
        logo: {
          "@type": "ImageObject",
          url: DEFAULT_IMAGE,
        },
      },
    };

    if (publishedTime) {
      schema.datePublished = publishedTime;
    }

    if (modifiedTime) {
      schema.dateModified = modifiedTime;
    }

    // Chặn chuỗi đóng script trong JSON-LD
    const safeJson = JSON.stringify(schema).replace(/</g, "\\u003c");

    const seoTags = `
<meta name="description"
 content="${escapeHtml(description)}"/>

<meta name="robots"
 content="index, follow, max-image-preview:large"/>

<link rel="canonical"
 href="${escapeHtml(canonical)}"/>

<meta property="og:type" content="article"/>
<meta property="og:site_name"
 content="Việt Nam Tour"/>
<meta property="og:title"
 content="${escapeHtml(title)}"/>
<meta property="og:description"
 content="${escapeHtml(description)}"/>
<meta property="og:url"
 content="${escapeHtml(canonical)}"/>
<meta property="og:image"
 content="${escapeHtml(image)}"/>

<meta name="twitter:card"
 content="summary_large_image"/>
<meta name="twitter:title"
 content="${escapeHtml(title)}"/>
<meta name="twitter:description"
 content="${escapeHtml(description)}"/>
<meta name="twitter:image"
 content="${escapeHtml(image)}"/>

<script type="application/ld+json">
${safeJson}
</script>

${getBlogFallbackStyle()}
`;

    // Lấy HTML React gốc
    let html = getFrontendHtml();

    // Bổ sung metadata SEO
    html = injectSeoHead(html, title, seoTags);

    // Tạo nội dung bài viết đã sanitize
    const articleHtml = buildBlogHtml(post, canonical);

    // Đưa vào chính React root,
    // KHÔNG tạo article bên ngoài root.
    html = injectBlogIntoRoot(html, articleHtml);

    return res.status(200).type("html").send(html);
  } catch (error) {
    console.error("SEO BLOG RENDER ERROR:", error);

    return res.status(500).sendFile(FRONTEND_INDEX);
  }
};

/* =====================================================
   EXPORT
===================================================== */

module.exports = {
  renderTour,
  renderTourList,
  renderBlog,
};
