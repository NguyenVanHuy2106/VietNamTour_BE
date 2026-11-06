const fs = require("fs");
const path = require("path");
const Posts = require("../models/posts.model");

const FRONTEND_INDEX =
  process.env.FRONTEND_INDEX || "/var/www/VietNamTour_FE/build/index.html";

const SITE_URL = "https://myvietnamtour.vn";
const PAGE_SIZE = 12;

// Đổi giá trị này nếu trạng thái bài công khai không phải 1.
const PUBLISHED_STATUS = 1;

function escapeHtml(value) {
  return String(value == null ? "" : value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function stripHtml(value) {
  return String(value == null ? "" : value)
    .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, " ")
    .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function blogPageUrl(page) {
  return page === 1 ? "/blog" : "/blog?page=" + page;
}

function cleanDescription(value, maxLength) {
  const text = stripHtml(value);

  if (text.length <= maxLength) {
    return text;
  }

  return text.slice(0, maxLength).trim() + "...";
}

function getPageNumber(rawPage) {
  const value = String(rawPage == null ? "1" : rawPage);

  if (!/^[1-9]\d*$/.test(value)) {
    return null;
  }

  const page = Number(value);

  if (!Number.isSafeInteger(page) || page > 10000) {
    return null;
  }

  return page;
}

function buildBlogCard(post) {
  const slug = String(post.slug || "").trim();

  if (!slug) {
    return "";
  }

  const href = "/blog/" + encodeURIComponent(slug);
  const title = escapeHtml(post.title || slug);

  const description = cleanDescription(post.description || "", 180);

  let dateHtml = "";

  if (post.created_at) {
    const date = new Date(post.created_at);

    if (!isNaN(date.getTime())) {
      const isoDate = date.toISOString().split("T")[0];

      dateHtml =
        '<time datetime="' +
        isoDate +
        '">' +
        escapeHtml(
          date.toLocaleDateString("vi-VN", {
            day: "2-digit",
            month: "2-digit",
            year: "numeric",
          }),
        ) +
        "</time>";
    }
  }

  return `
    <article class="seo-blog-item">
      <h2>
        <a href="${escapeHtml(href)}">
          ${title}
        </a>
      </h2>

      ${dateHtml}

      ${description ? `<p>${escapeHtml(description)}</p>` : ""}
    </article>
  `;
}

function buildPagination(page, totalPages) {
  if (totalPages <= 1) {
    return "";
  }

  const links = [];

  if (page > 1) {
    links.push(
      `<a href="${blogPageUrl(page - 1)}" rel="prev">
        Trang trước
      </a>`,
    );
  }

  let lastShown = 0;

  for (let i = 1; i <= totalPages; i++) {
    const shouldShow = i === 1 || i === totalPages || Math.abs(i - page) <= 2;

    if (!shouldShow) {
      continue;
    }

    if (lastShown && i - lastShown > 1) {
      links.push("<span>...</span>");
    }

    if (i === page) {
      links.push(`<span aria-current="page">Trang ${i}</span>`);
    } else {
      links.push(`<a href="${blogPageUrl(i)}">Trang ${i}</a>`);
    }

    lastShown = i;
  }

  if (page < totalPages) {
    links.push(
      `<a href="${blogPageUrl(page + 1)}" rel="next">
        Trang sau
      </a>`,
    );
  }

  return `
    <nav class="seo-blog-pagination"
      aria-label="Phân trang bài viết">
      ${links.join("\n")}
    </nav>
  `;
}

function buildBlogListHtml(posts, page, totalPages) {
  const cards = posts.map(buildBlogCard).filter(Boolean).join("\n");

  const pagination = buildPagination(page, totalPages);

  return `
    <main class="seo-blog-list">
      <header>
        <h1>Bản tin du lịch Việt Nam Tour</h1>

        <p>
          Khám phá cẩm nang du lịch, kinh nghiệm
          tham quan, điểm đến nổi bật và những
          thông tin hữu ích dành cho du khách,
          doanh nghiệp và các đoàn khách.
        </p>
      </header>

      <section
        class="seo-blog-articles"
        aria-label="Danh sách bài viết du lịch"
      >
        ${cards || "<p>Hiện chưa có bài viết nào.</p>"}
      </section>

      ${pagination}
    </main>
  `;
}

function makeHead(title, description, canonical, page, totalPages) {
  const prevUrl = page > 1 ? SITE_URL + blogPageUrl(page - 1) : null;

  const nextUrl = page < totalPages ? SITE_URL + blogPageUrl(page + 1) : null;

  const schema = {
    "@context": "https://schema.org",
    "@type": "CollectionPage",
    "@id": canonical + "#webpage",
    url: canonical,
    name: title,
    description: description,
    inLanguage: "vi-VN",
    isPartOf: {
      "@type": "WebSite",
      name: "Việt Nam Tour",
      url: SITE_URL,
    },
  };

  const safeSchema = JSON.stringify(schema).replace(/</g, "\\u003c");

  return `
    <title>${escapeHtml(title)}</title>

    <meta
      name="description"
      content="${escapeHtml(description)}"
    >

    <link
      rel="canonical"
      href="${escapeHtml(canonical)}"
    >

    ${prevUrl ? `<link rel="prev" href="${escapeHtml(prevUrl)}">` : ""}

    ${nextUrl ? `<link rel="next" href="${escapeHtml(nextUrl)}">` : ""}

    <meta property="og:type" content="website">

    <meta
      property="og:title"
      content="${escapeHtml(title)}"
    >

    <meta
      property="og:description"
      content="${escapeHtml(description)}"
    >

    <meta
      property="og:url"
      content="${escapeHtml(canonical)}"
    >

    <script type="application/ld+json">
      ${safeSchema}
    </script>
  `;
}

function injectSeoHtml(html, headHtml, bodyHtml) {
  let result = html;

  // Tránh trùng title, description, canonical và OG.
  result = result.replace(/<title\b[^>]*>[\s\S]*?<\/title>/gi, "");

  result = result.replace(
    /<meta\b(?=[^>]*\bname=["']description["'])[^>]*>/gi,
    "",
  );

  result = result.replace(
    /<link\b(?=[^>]*\brel=["']canonical["'])[^>]*>/gi,
    "",
  );

  result = result.replace(
    /<meta\b(?=[^>]*\bproperty=["']og:[^"']+["'])[^>]*>/gi,
    "",
  );

  result = result.replace(/<\/head>/i, headHtml + "\n</head>");

  // React build hiện dùng div#root rỗng.
  // Chèn fallback HTML để crawler đọc được nội dung.
  const rootPattern =
    /(<div\b[^>]*\bid=["']root["'][^>]*>)([\s\S]*?)(<\/div>)/i;

  if (!rootPattern.test(result)) {
    throw new Error("Không tìm thấy div#root trong frontend index.html");
  }

  result = result.replace(
    rootPattern,
    function (match, openTag, content, closeTag) {
      return openTag + bodyHtml + closeTag;
    },
  );

  return result;
}

const renderBlogList = async (req, res) => {
  try {
    const page = getPageNumber(req.query.page);

    if (!page) {
      return res.status(404).send("Trang blog không tồn tại");
    }

    const result = await Posts.findAndCountAll({
      attributes: ["post_id", "title", "slug", "description", "created_at"],
      where: {
        status: PUBLISHED_STATUS,
      },
      order: [
        ["created_at", "DESC"],
        ["post_id", "DESC"],
      ],
      limit: PAGE_SIZE,
      offset: (page - 1) * PAGE_SIZE,
    });

    const totalPages = Math.max(1, Math.ceil(result.count / PAGE_SIZE));

    if (page > totalPages) {
      return res.status(404).send("Trang blog không tồn tại");
    }

    const canonical = SITE_URL + blogPageUrl(page);

    const title =
      page === 1
        ? "Bản tin du lịch | Việt Nam Tour"
        : `Bản tin du lịch - Trang ${page} | Việt Nam Tour`;

    const description =
      "Bản tin du lịch Việt Nam Tour: cẩm nang " +
      "du lịch, kinh nghiệm tham quan, điểm đến " +
      "nổi bật và thông tin dành cho khách đoàn.";

    const bodyHtml = buildBlogListHtml(result.rows, page, totalPages);

    const headHtml = makeHead(title, description, canonical, page, totalPages);

    if (!fs.existsSync(FRONTEND_INDEX)) {
      console.error("[SEO Blog List] Không tìm thấy:", FRONTEND_INDEX);

      return res.status(500).send("Không tìm thấy frontend index.html");
    }

    const originalHtml = fs.readFileSync(FRONTEND_INDEX, "utf8");

    const finalHtml = injectSeoHtml(originalHtml, headHtml, bodyHtml);

    res.set("Cache-Control", "no-cache");

    return res.status(200).type("html").send(finalHtml);
  } catch (error) {
    console.error("[SEO Blog List] Render error:", error);

    return res.status(500).send("Có lỗi khi tải danh sách bài viết");
  }
};

module.exports = {
  renderBlogList,
};
