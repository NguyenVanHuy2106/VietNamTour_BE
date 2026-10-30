const express = require("express");

const router = express.Router();

const { verifyToken } = require("../middlewares/auth");

const {
  importData,
  getEntities,
  getEntityById,
  getStats,
  deleteEntity,
  getMyEntities,
  claimEntity,
  updateCare,
  updateEntity,
} = require("../controllers/procurement/procurementEntity.controller");

// ==========================================================
// IMPORT
// ==========================================================

router.post("/api/procurement/import", verifyToken, importData);

// ==========================================================
// STATS
// ==========================================================

router.get("/api/procurement/stats", verifyToken, getStats);

// ==========================================================
// LIST
// ==========================================================

router.get("/api/procurement/entities", verifyToken, getEntities);

// ==========================================================
// DETAIL
// ==========================================================

router.get("/api/procurement/entities/:id", verifyToken, getEntityById);

// ==========================================================
// DELETE
// ==========================================================

router.delete("/api/procurement/entities/:id", verifyToken, deleteEntity);

router.get("/api/procurement/my-entities", verifyToken, getMyEntities);

router.post("/api/procurement/entities/:id/claim", verifyToken, claimEntity);

router.put("/api/procurement/entities/:id/care", verifyToken, updateCare);

// ==========================================================
// UPDATE ENTITY DATA
// ==========================================================

router.put("/api/procurement/entities/:id", verifyToken, updateEntity);

module.exports = router;
