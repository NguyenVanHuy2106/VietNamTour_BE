const { procurementEntity } = require("../../models");

// ==========================================================
// CLEAN TEXT
// ==========================================================

const cleanText = (value) => {
  if (value === null || value === undefined) {
    return null;
  }

  const text = String(value).replace(/\s+/g, " ").trim();

  return text || null;
};

// ==========================================================
// CLEAN PHONE
// ==========================================================

const cleanPhone = (value) => {
  const text = cleanText(value);

  if (!text) {
    return null;
  }

  return text.replace(/[^\d+]/g, "").trim();
};

// ==========================================================
// PARSE DATE ARRAY
//
// Ví dụ:
// [2026, 10, 22, 10, 6, 58]
// ==========================================================

const parseDateArray = (value) => {
  if (!Array.isArray(value)) {
    return null;
  }

  if (value.length < 3) {
    return null;
  }

  const [year, month, day, hour = 0, minute = 0, second = 0] = value;

  const date = new Date(
    Number(year),
    Number(month) - 1,
    Number(day),
    Number(hour || 0),
    Number(minute || 0),
    Number(second || 0),
  );

  if (Number.isNaN(date.getTime())) {
    return null;
  }

  return date;
};

// ==========================================================
// REMOVE CODE BLOCK
//
// Cho phép FE paste:
// ```json
// {...}
// ```
// ==========================================================

const removeCodeFence = (value) => {
  if (typeof value !== "string") {
    return value;
  }

  return value
    .replace(/^```(?:json|javascript|js)?\s*/i, "")
    .replace(/\s*```$/i, "")
    .trim();
};

// ==========================================================
// PARSE INPUT
// ==========================================================

const parseInput = (input) => {
  if (!input) {
    throw new Error("Không có dữ liệu để import.");
  }

  // Nếu FE gửi object JSON trực tiếp
  if (typeof input === "object") {
    return input;
  }

  if (typeof input !== "string") {
    throw new Error("Dữ liệu import không hợp lệ.");
  }

  const cleaned = removeCodeFence(input);

  try {
    return JSON.parse(cleaned);
  } catch (error) {
    throw new Error("JSON không hợp lệ. Vui lòng paste nguyên dữ liệu JSON.");
  }
};

// ==========================================================
// EXTRACT RECORDS
//
// Hỗ trợ:
//
// {
//   ebidOrgInfos: {
//     content: []
//   }
// }
//
// hoặc:
// {
//   data: {
//     ebidOrgInfos: {
//       content: []
//     }
//   }
// }
//
// hoặc:
// { content: [] }
//
// hoặc array:
//
// [...]
//
// hoặc 1 object:
// {
//   orgCode: "..."
// }
// ==========================================================

const extractRecords = (payload) => {
  if (!payload) {
    return [];
  }

  if (Array.isArray(payload)) {
    return payload;
  }

  if (payload.ebidOrgInfos && Array.isArray(payload.ebidOrgInfos.content)) {
    return payload.ebidOrgInfos.content;
  }

  if (
    payload.data?.ebidOrgInfos &&
    Array.isArray(payload.data.ebidOrgInfos.content)
  ) {
    return payload.data.ebidOrgInfos.content;
  }

  if (Array.isArray(payload.content)) {
    return payload.content;
  }

  if (payload.orgCode || payload.org_code || payload.tendererCode) {
    return [payload];
  }

  throw new Error("Không tìm thấy ebidOrgInfos.content trong JSON.");
};

// ==========================================================
// REPRESENTATIVE POSITION
//
// Payload hiện tại có thể chưa có chức vụ.
// Nếu sau này detail API trả các field này thì sẽ tự nhận.
// ==========================================================

const getRepresentativePosition = (item) => {
  return cleanText(
    item.repPosition ||
      item.repTitle ||
      item.position ||
      item.positionName ||
      item.repPositionName ||
      item.representativePosition ||
      item.representative_position ||
      null,
  );
};

// ==========================================================
// NORMALIZE RECORD
// ==========================================================

const normalizeRecord = (item) => {
  if (!item || typeof item !== "object") {
    return {
      valid: false,
      reason: "INVALID_RECORD",
    };
  }

  const orgCode = cleanText(item.orgCode || item.org_code || item.tendererCode);

  const organizationName = cleanText(
    item.orgFullname ||
      item.organizationName ||
      item.organization_name ||
      item.name,
  );

  if (!orgCode) {
    return {
      valid: false,
      reason: "MISSING_ORG_CODE",
    };
  }

  if (!organizationName) {
    return {
      valid: false,
      reason: "MISSING_ORGANIZATION_NAME",
      org_code: orgCode,
    };
  }

  return {
    valid: true,

    data: {
      org_code: orgCode,

      organization_name: organizationName,

      address: cleanText(item.officeAdd || item.officeAddress || item.address),

      representative_name: cleanText(
        item.repFullname || item.representativeName || item.representative_name,
      ),

      representative_position: getRepresentativePosition(item),

      phone: cleanPhone(item.officePhone || item.phone || item.phoneNumber),

      tax_code: cleanText(item.taxCode || item.tax_code),

      province_code: cleanText(item.officePro || item.provinceCode),

      district_code: cleanText(item.officeDis || item.districtCode),

      business_type: cleanText(item.businessType),

      source_role: cleanText(item.parentName),

      source_status:
        item.status !== undefined && item.status !== null
          ? Number(item.status)
          : null,

      approved_at: parseDateArray(item.effRoleDate),

      source_type: "MUASAMCONG",

      raw_data: item,
    },
  };
};

// ==========================================================
// IMPORT ONE RECORD
// ==========================================================

const importOne = async (item) => {
  const normalized = normalizeRecord(item);

  if (!normalized.valid) {
    return {
      status: "SKIPPED",

      reason: normalized.reason,

      org_code: normalized.org_code || null,
    };
  }

  const data = normalized.data;

  // ========================================================
  // CHECK DUPLICATE
  // ========================================================

  const existing = await procurementEntity.findOne({
    where: {
      org_code: data.org_code,
    },
  });

  if (existing) {
    return {
      status: "DUPLICATE",

      reason: "ORG_CODE_EXISTS",

      id: existing.id,

      org_code: existing.org_code,

      organization_name: existing.organization_name,
    };
  }

  // ========================================================
  // INSERT
  // ========================================================

  try {
    const created = await procurementEntity.create(data);

    return {
      status: "INSERTED",

      id: created.id,

      org_code: created.org_code,

      organization_name: created.organization_name,
    };
  } catch (error) {
    // Race-condition
    if (error?.name === "SequelizeUniqueConstraintError") {
      const duplicate = await procurementEntity.findOne({
        where: {
          org_code: data.org_code,
        },
      });

      return {
        status: "DUPLICATE",

        reason: "ORG_CODE_EXISTS",

        id: duplicate?.id || null,

        org_code: data.org_code,

        organization_name:
          duplicate?.organization_name || data.organization_name,
      };
    }

    throw error;
  }
};

// ==========================================================
// IMPORT ALL
// ==========================================================

const importProcurementData = async (rawInput) => {
  const payload = parseInput(rawInput);

  const records = extractRecords(payload);

  let inserted = 0;
  let duplicates = 0;
  let skipped = 0;
  let errors = 0;

  const results = [];

  for (const item of records) {
    try {
      const result = await importOne(item);

      results.push(result);

      if (result.status === "INSERTED") {
        inserted += 1;
      } else if (result.status === "DUPLICATE") {
        duplicates += 1;
      } else {
        skipped += 1;
      }
    } catch (error) {
      errors += 1;

      results.push({
        status: "ERROR",

        org_code: item?.orgCode || item?.org_code || null,

        organization_name: item?.orgFullname || null,

        message: error?.message || "Unknown error",
      });
    }
  }

  return {
    total: records.length,

    inserted,

    duplicates,

    skipped,

    errors,

    results,
  };
};

module.exports = {
  importProcurementData,
  importOne,
  normalizeRecord,
  extractRecords,
};
