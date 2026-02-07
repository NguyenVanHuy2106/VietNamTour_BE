// 1. Gọi Models đúng cách như trong controller của bạn
const Tour = require("../models/tours/tour.model");
const db = require("../models");
const { Post } = db;

const getSitemap = async (req, res) => {
  try {
    const baseUrl = "https://myvietnamtour.vn";

    // 2. Sử dụng .findAll() của Sequelize thay vì .find()
    // Lấy Tour (Chỉ lấy tour không phải khách đoàn hoặc tùy bạn lọc)
    const tours = await Tour.findAll({
      attributes: ["slug", "created_at"],
      raw: true,
    });

    // Lấy Post (Bài viết)
    const posts = await Post.findAll({
      where: { status: 1 },
      attributes: ["category_id", "slug", "created_at"],
      raw: true,
    });

    // 3. Tạo Header XML
    // 3. Khai báo danh sách trang tĩnh (Thêm bao nhiêu tùy ý ở đây)
    const staticPages = [
      { url: "/", freq: "daily", priority: "1.0" },
      { url: "/dich-vu/team-building", freq: "monthly", priority: "0.5" },
      { url: "/dich-vu/du-lich-trong-nuoc", freq: "monthly", priority: "0.5" },
      { url: "/dich-vu/to-chuc-su-kien", freq: "weekly", priority: "0.8" },
      { url: "/dich-vu/cho-thue-xe", freq: "daily", priority: "0.8" },
      { url: "/dich-vu/du-lich-hoc-tap", freq: "daily", priority: "0.9" },
      { url: "/dich-vu/du-lich-mice", freq: "weekly", priority: "0.9" }, // Cho route tourType "DOAN"
      { url: "/dich-vu/year-end-party", freq: "weekly", priority: "0.8" },
      { url: "/dich-vu/hoi-nghi-hoi-thao", freq: "weekly", priority: "0.8" },
      { url: "/dich-vu/booking-dich-vu", freq: "weekly", priority: "0.8" },
      { url: "/danh-sach-tour", freq: "weekly", priority: "0.8" },
      { url: "/blog", freq: "weekly", priority: "0.8" },
      { url: "/tin-tuc-su-kien", freq: "weekly", priority: "0.8" },
      { url: "/hinh-anh", freq: "weekly", priority: "0.8" },
      { url: "/danh-gia", freq: "weekly", priority: "0.8" },
    ];

    let xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">`;

    // Duyệt qua mảng trang tĩnh để tạo XML
    staticPages.forEach((page) => {
      xml += `
  <url>
    <loc>${baseUrl}${page.url}</loc>
    <changefreq>${page.freq}</changefreq>
    <priority>${page.priority}</priority>
  </url>`;
    });

    // 4. Đổ dữ liệu Tour vào XML
    tours.forEach((tour) => {
      const dateValue = tour.created_at || new Date();
      const date = new Date(dateValue).toISOString().split("T")[0];
      xml += `
  <url>
    <loc>${baseUrl}/tour/${tour.slug}</loc>
    <lastmod>${date}</lastmod>
    <changefreq>weekly</changefreq>
    <priority>0.9</priority>
  </url>`;
    });

    // 5. Đổ dữ liệu Post vào XML
    posts.forEach((post) => {
      const date = new Date(post.created_at || new Date())
        .toISOString()
        .split("T")[0];

      // LOGIC THAY ĐỔI LINK Ở ĐÂY
      let postUrl;
      if (post.category_id == 13) {
        postUrl = `${baseUrl}/tin-tuc-su-kien/${post.slug}`;
      } else {
        postUrl = `${baseUrl}/blog/${post.slug}`;
      }

      xml += `
  <url>
    <loc>${postUrl}</loc>
    <lastmod>${date}</lastmod>
    <changefreq>weekly</changefreq>
    <priority>0.8</priority>
  </url>`;
    });

    xml += `\n</urlset>`;

    // 6. Trả về đúng định dạng XML
    res.header("Content-Type", "application/xml");
    res.status(200).send(xml);
  } catch (error) {
    console.error("Sitemap Error:", error);
    res.status(500).send("Lỗi tạo sitemap: " + error.message);
  }
};

module.exports = { getSitemap };
