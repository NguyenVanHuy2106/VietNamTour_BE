const express = require("express");
const router = express.Router();
const sitemapController = require("../controllers/sitemap.controller");

// Route này sẽ chạy tại: myvietnamtour.vn/sitemap.xml
router.get("/sitemap.xml", sitemapController.getSitemap);

module.exports = router;
