const express = require("express");

const router = express.Router();

const { renderTour, renderTourList } = require("../controllers/seo.controller");

router.get("/danh-sach-tour", renderTourList);

router.get("/tour/:slug", renderTour);

module.exports = router;
