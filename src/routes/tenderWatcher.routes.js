const express = require("express");

const router = express.Router();

const { verifyToken } = require("../middlewares/auth");

// ======================================================
// SEARCH / WATCHER CONTROLLER
// ======================================================

const {
  getQueries,

  getQuota,

  search,

  searchSingle,
} = require("../controllers/lead_ai/tenderWatcher.controller");

// ======================================================
// ITEM CONTROLLER
// ======================================================

const {
  getTenderItems,

  getTenderItemDetail,

  getTenderStats,

  getTenderFilterOptions,
} = require("../controllers/lead_ai/tenderItem.controller");

// ======================================================
// FE DATA
// ======================================================

// Dashboard stats
router.get(
  "/api/tender/stats",

  verifyToken,

  getTenderStats,
);

// Dropdown filter
router.get(
  "/api/tender/filter-options",

  verifyToken,

  getTenderFilterOptions,
);

// Danh sách Tender
router.get(
  "/api/tender/items",

  verifyToken,

  getTenderItems,
);

// Chi tiết Tender
router.get(
  "/api/tender/items/:id",

  verifyToken,

  getTenderItemDetail,
);

// ======================================================
// TENDER SEARCH
// ======================================================

// Danh sách query
router.get(
  "/api/tender/queries",

  verifyToken,

  getQueries,
);

// SerpAPI quota
router.get(
  "/api/tender/quota",

  verifyToken,

  getQuota,
);

// ======================================================
// NÚT "LẤY DỮ LIỆU" TRÊN FE
// ======================================================

router.post(
  "/api/tender/search",

  verifyToken,

  search,
);

// Test một query
router.post(
  "/api/tender/search/test",

  verifyToken,

  searchSingle,
);

module.exports = router;
