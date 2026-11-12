const express = require("express");
const rateLimitPackage = require("express-rate-limit");

const {
  createTourQuoteRequest,
  getMyTourQuoteRequests,
} = require("../controllers/tourQuoteRequest.controller");

/* ==========================================
   VIET NAM TOUR
   TOUR QUOTE REQUEST ROUTES

   1. CREATE TOUR QUOTE REQUEST
   2. LOOKUP TOUR QUOTE REQUESTS BY PHONE
========================================== */

const router = express.Router();

/* ==========================================
   RATE LIMIT PACKAGE
========================================== */

const rateLimit = rateLimitPackage.rateLimit || rateLimitPackage;

/* ==========================================
   1. CREATE REQUEST RATE LIMIT

   5 REQUESTS / 15 MINUTES / IP
========================================== */

const quoteRequestLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,

  limit: 5,

  standardHeaders: "draft-7",

  legacyHeaders: false,

  message: {
    success: false,

    message:
      "Bạn đã gửi quá nhiều yêu cầu báo giá. " +
      "Vui lòng thử lại sau 15 phút.",
  },
});

/* ==========================================
   2. LOOKUP RATE LIMIT

   30 REQUESTS / 15 MINUTES / IP
========================================== */

const quoteLookupLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,

  limit: 30,

  standardHeaders: "draft-7",

  legacyHeaders: false,

  message: {
    success: false,

    message: "Bạn đã tra cứu quá nhiều lần. " + "Vui lòng thử lại sau 15 phút.",

    data: [],
  },
});

/* ==========================================
   PUBLIC API 1
   CREATE TOUR QUOTE REQUEST

   METHOD: POST

   ENDPOINT:
   /api/tour-quote-requests
========================================== */

router.post(
  "/api/tour-quote-requests",

  quoteRequestLimiter,

  createTourQuoteRequest,
);

/* ==========================================
   PUBLIC API 2
   LOOKUP REQUESTS BY PHONE

   METHOD: POST

   ENDPOINT:
   /api/tour-quote-requests/my-list

   BODY:
   {
     "customer_phone": "0901234567"
   }

   NO OTP
   NO AUTHENTICATION
   NO SUBMISSION KEYS
========================================== */

router.post(
  "/api/tour-quote-requests/my-list",

  quoteLookupLimiter,

  getMyTourQuoteRequests,
);

/* ==========================================
   EXPORT ROUTER
========================================== */

module.exports = router;
