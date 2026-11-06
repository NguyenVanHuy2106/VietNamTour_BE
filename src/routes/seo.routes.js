const express = require("express");

const router = express.Router();

const {
  renderTour,
  renderTourList,
  renderBlog,
} = require("../controllers/seo.controller");
const { renderBlogList } = require("../controllers/seoBlogList.controller");

router.get("/danh-sach-tour", renderTourList);

router.get("/tour/:slug", renderTour);

router.get("/blog", renderBlogList);
router.get("/blog/:slug", renderBlog);

module.exports = router;
