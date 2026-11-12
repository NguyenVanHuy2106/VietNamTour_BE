const { QueryTypes, UniqueConstraintError } = require("sequelize");

const sequelize = require("../config/database");

const TourQuoteRequest = require("../models/tourQuoteRequest.model");

/* ==========================================
   VIET NAM TOUR
   TOUR QUOTE REQUEST CONTROLLER

   1. CREATE TOUR QUOTE REQUEST
   2. GET REQUESTS BY PHONE

   DATABASE:
   vntour.vn_tour_quote_requests
========================================== */

const SITE_URL = "https://myvietnamtour.vn";

/* ==========================================
   HELPERS
========================================== */

function cleanText(value) {
  if (value === null || value === undefined) {
    return "";
  }

  return String(value).trim();
}

/* ==========================================
   NORMALIZE PHONE
========================================== */

function normalizePhone(value) {
  let phone = cleanText(value).replace(/[\s().-]/g, "");

  // +84xxxxxxxxx -> 0xxxxxxxxx
  if (/^\+84[0-9]{9}$/.test(phone)) {
    phone = "0" + phone.slice(3);
  }

  // 84xxxxxxxxx -> 0xxxxxxxxx
  if (/^84[0-9]{9}$/.test(phone)) {
    phone = "0" + phone.slice(2);
  }

  return phone;
}

function isValidPhone(phone) {
  return /^0[0-9]{9}$/.test(phone);
}

/* ==========================================
   VALIDATE UUID
   CHỈ DÙNG CHỐNG GỬI TRÙNG
========================================== */

function isValidUUID(value) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
    value,
  );
}

/* ==========================================
   PARSE GUEST COUNT
========================================== */

function parseGuestCount(value) {
  if (value === null || value === undefined || value === "") {
    return null;
  }

  const number = Number(value);

  if (!Number.isSafeInteger(number) || number < 1 || number > 100000) {
    return false;
  }

  return number;
}

/* ==========================================
   PARSE DEPARTURE DATE
========================================== */

function parseDepartureDate(value) {
  if (value === null || value === undefined || value === "") {
    return null;
  }

  const text = cleanText(value);

  if (!/^\d{4}-\d{2}-\d{2}$/.test(text)) {
    return false;
  }

  const date = new Date(text + "T00:00:00Z");

  if (Number.isNaN(date.getTime())) {
    return false;
  }

  if (date.toISOString().slice(0, 10) !== text) {
    return false;
  }

  return text;
}

/* ==========================================
   SUCCESS RESPONSE
========================================== */

function successResponse(res, request, existing) {
  return res.status(existing ? 200 : 201).json({
    success: true,

    message: "Yêu cầu báo giá đã được tiếp nhận thành công.",

    data: {
      id: request.id,

      request_code: request.request_code,

      status: request.status,

      created_at: request.created_at,
    },
  });
}

/* ==========================================
   VALIDATION ERROR
========================================== */

function validationError(res, message) {
  return res.status(400).json({
    success: false,
    message: message,
  });
}

/* ==========================================
   API 1:
   CREATE TOUR QUOTE REQUEST

   POST /api/tour-quote-requests
========================================== */

const createTourQuoteRequest = async (req, res) => {
  try {
    const body = req.body || {};

    /* ======================================
       1. NHẬN DỮ LIỆU
    ====================================== */

    const tourId = Number(body.tour_id);

    const customerType = cleanText(body.customer_type || "B2C").toUpperCase();

    const customerName = cleanText(body.customer_name);

    const customerPhone = normalizePhone(body.customer_phone);

    const companyName = cleanText(body.company_name);

    const note = cleanText(body.note);

    const guestCount = parseGuestCount(body.guest_count);

    const departureDate = parseDepartureDate(body.departure_date);

    const submissionKey = cleanText(body.submission_key);

    /* ======================================
       2. VALIDATION
    ====================================== */

    if (!Number.isSafeInteger(tourId) || tourId <= 0) {
      return validationError(res, "Chương trình tour không hợp lệ.");
    }

    if (customerType !== "B2B" && customerType !== "B2C") {
      return validationError(res, "Loại khách hàng không hợp lệ.");
    }

    if (customerName.length < 2 || customerName.length > 150) {
      return validationError(res, "Họ tên phải có từ 2 đến 150 ký tự.");
    }

    if (!isValidPhone(customerPhone)) {
      return validationError(res, "Số điện thoại không hợp lệ.");
    }

    if (companyName.length > 255) {
      return validationError(res, "Tên đơn vị không được vượt quá 255 ký tự.");
    }

    if (guestCount === false) {
      return validationError(res, "Số lượng khách không hợp lệ.");
    }

    if (departureDate === false) {
      return validationError(res, "Ngày khởi hành không hợp lệ.");
    }

    if (note.length > 5000) {
      return validationError(res, "Nội dung yêu cầu tối đa 5000 ký tự.");
    }

    if (submissionKey && !isValidUUID(submissionKey)) {
      return validationError(res, "Mã gửi yêu cầu không hợp lệ.");
    }

    /* ======================================
       3. CHỐNG GỬI TRÙNG

       submission_key vẫn được giữ cho
       chức năng tạo yêu cầu.

       Không dùng để tra cứu danh sách.
    ====================================== */

    if (submissionKey) {
      const existingRequest = await TourQuoteRequest.findOne({
        where: {
          submission_key: submissionKey,
        },
      });

      if (existingRequest) {
        return successResponse(res, existingRequest, true);
      }
    }

    /* ======================================
       4. KIỂM TRA TOUR TỒN TẠI
    ====================================== */

    const tours = await sequelize.query(
      `
        SELECT
          tourid,
          tourname,
          slug
        FROM vntour.vn_tour
        WHERE tourid = :tourId
        LIMIT 1
      `,
      {
        replacements: {
          tourId: tourId,
        },

        type: QueryTypes.SELECT,
      },
    );

    if (!tours || tours.length === 0) {
      return res.status(404).json({
        success: false,

        message: "Không tìm thấy chương trình tour.",
      });
    }

    const tour = tours[0];

    /* ======================================
       5. XÁC ĐỊNH NGUỒN YÊU CẦU
    ====================================== */

    let sourceUrl = null;

    if (tour.slug) {
      sourceUrl = SITE_URL + "/tour/" + encodeURIComponent(tour.slug);
    }

    /* ======================================
       6. LƯU YÊU CẦU
    ====================================== */

    const quoteRequest = await TourQuoteRequest.create({
      tour_id: tourId,

      tour_name: tour.tourname,

      customer_type: customerType,

      customer_name: customerName,

      customer_phone: customerPhone,

      company_name: companyName || null,

      guest_count: guestCount,

      departure_date: departureDate,

      note: note || null,

      source_url: sourceUrl,

      status: "NEW",

      submission_key: submissionKey || null,

      created_at: new Date(),

      updated_at: new Date(),
    });

    /* ======================================
       7. TRẢ THÀNH CÔNG
    ====================================== */

    return successResponse(res, quoteRequest, false);
  } catch (error) {
    /* ======================================
       8. XỬ LÝ GỬI TRÙNG
    ====================================== */

    if (error instanceof UniqueConstraintError) {
      const submissionKey = cleanText(req.body && req.body.submission_key);

      if (submissionKey) {
        try {
          const existingRequest = await TourQuoteRequest.findOne({
            where: {
              submission_key: submissionKey,
            },
          });

          if (existingRequest) {
            return successResponse(res, existingRequest, true);
          }
        } catch (lookupError) {
          console.error(
            "Quote request duplicate lookup error:",
            lookupError.message,
          );
        }
      }

      return res.status(409).json({
        success: false,

        message: "Yêu cầu đã tồn tại. Vui lòng kiểm tra lại.",
      });
    }

    /* ======================================
       9. SERVER ERROR
    ====================================== */

    console.error("Create tour quote request error:", error.message);

    return res.status(500).json({
      success: false,

      message:
        "Không thể tiếp nhận yêu cầu báo giá. " + "Vui lòng thử lại sau.",
    });
  }
};

/* ==========================================
   API 2:
   GET MY TOUR QUOTE REQUESTS

   POST /api/tour-quote-requests/my-list

   TRA CỨU THEO SỐ ĐIỆN THOẠI

   KHÔNG OTP
   KHÔNG LOCAL STORAGE
   KHÔNG SUBMISSION KEY
========================================== */

const getMyTourQuoteRequests = async (req, res) => {
  try {
    /* ======================================
       1. NHẬN SỐ ĐIỆN THOẠI
    ====================================== */

    const body = req.body || {};

    const customerPhone = normalizePhone(body.customer_phone);

    /* ======================================
       2. VALIDATION
    ====================================== */

    if (!isValidPhone(customerPhone)) {
      return res.status(400).json({
        success: false,

        message: "Vui lòng nhập số điện thoại hợp lệ.",

        data: [],
      });
    }

    /* ======================================
       3. TRUY VẤN DATABASE

       Chỉ trả về thông tin cơ bản,
       không trả về dữ liệu cá nhân.
    ====================================== */

    const requests = await TourQuoteRequest.findAll({
      attributes: ["request_code", "tour_name", "status", "created_at"],

      where: {
        customer_phone: customerPhone,
      },

      order: [
        ["created_at", "DESC"],
        ["id", "DESC"],
      ],

      limit: 50,

      raw: true,
    });

    /* ======================================
       4. TRẢ DANH SÁCH
    ====================================== */

    return res.status(200).json({
      success: true,

      message:
        requests.length > 0
          ? "Tra cứu yêu cầu báo giá thành công."
          : "Không tìm thấy yêu cầu báo giá.",

      data: requests,

      total: requests.length,
    });
  } catch (error) {
    /* ======================================
       5. SERVER ERROR
    ====================================== */

    console.error("Get my tour quote requests error:", error.message);

    return res.status(500).json({
      success: false,

      message: "Không thể tra cứu yêu cầu báo giá. " + "Vui lòng thử lại sau.",

      data: [],
    });
  }
};

/* ==========================================
   EXPORTS
========================================== */

module.exports = {
  createTourQuoteRequest,
  getMyTourQuoteRequests,
};
