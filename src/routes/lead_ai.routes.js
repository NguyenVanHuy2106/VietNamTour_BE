const express = require("express");
const router = express.Router();

const { verifyToken } = require("../middlewares/auth");

const {
  manualDiscovery,
  getDiscoveryStatus,
} = require("../controllers/lead_ai/discovery.controller");
const {
  getWorkspaceCompanies,
  claimCompany,
  getMyCompanies,
  getMyCompanyDetail,
  updateMyCompany,
  getMyReport,
} = require("../controllers/lead_ai/goongCompany.controller");

const { processGoong } = require("../controllers/lead_ai/goong.controller");
const {
  getAdminDashboard,
  getAdminCompanies,
  getAdminCompanyDetail,
  getStaffPerformance,
} = require("../controllers/lead_ai/adminLead.controller");

// Kéo thủ công tối đa 100 công ty mới
router.post("/api/lead-ai/discovery/manual", verifyToken, manualDiscovery);

router.post("/api/lead-ai/goong/process", verifyToken, processGoong);

router.get("/api/lead-ai/discovery/status", verifyToken, getDiscoveryStatus);
/**
 * ==========================================
 * WORKSPACE CHUNG
 * ==========================================
 */

router.get("/api/lead-ai/workspace", verifyToken, getWorkspaceCompanies);

router.post("/api/lead-ai/workspace/:id/claim", verifyToken, claimCompany);

/**
 * ==========================================
 * CÔNG TY CỦA TÔI
 * ==========================================
 */

router.get("/api/lead-ai/my-companies", verifyToken, getMyCompanies);

router.get("/api/lead-ai/my-companies/report", verifyToken, getMyReport);

router.get("/api/lead-ai/my-companies/:id", verifyToken, getMyCompanyDetail);

router.put("/api/lead-ai/my-companies/:id", verifyToken, updateMyCompany);

// ==========================================================
// ADMIN LEAD AI
// ==========================================================

router.get("/api/lead-ai/admin/dashboard", verifyToken, getAdminDashboard);

router.get(
  "/api/lead-ai/admin/staff-performance",
  verifyToken,
  getStaffPerformance,
);

router.get("/api/lead-ai/admin/companies", verifyToken, getAdminCompanies);

router.get(
  "/api/lead-ai/admin/companies/:id",
  verifyToken,
  getAdminCompanyDetail,
);

module.exports = router;
