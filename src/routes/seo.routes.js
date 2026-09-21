const express = require("express");

const router = express.Router();

const { renderTour } = require("../controllers/seo.controller");

router.get("/tour/:slug", renderTour);

module.exports = router;
