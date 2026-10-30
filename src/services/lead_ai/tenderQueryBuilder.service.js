const TenderKeywordGroup = require("../../models/lead_ai/tenderKeywordGroup.model");

const TenderSetting = require("../../models/lead_ai/tenderSetting.model");

// ======================================================
// CONFIG
// ======================================================

const DEFAULT_MAX_QUERIES = 18;

// ======================================================
// GROUP CODES
// ======================================================

const GROUP_CODES = {
  PROCUREMENT_DIRECT: "PROCUREMENT_DIRECT",

  PROCUREMENT_SELECTION: "PROCUREMENT_SELECTION",

  PROCUREMENT_INTEREST: "PROCUREMENT_INTEREST",

  PROCUREMENT_PLANNING: "PROCUREMENT_PLANNING",

  TOUR: "TOUR",

  THAM_QUAN: "THAM_QUAN",

  NGHI_DUONG: "NGHI_DUONG",

  TEAM_BUILDING: "TEAM_BUILDING",

  VE_NGUON: "VE_NGUON",

  EXPANDED_TRAVEL: "EXPANDED_TRAVEL",

  TARGET_EMPLOYEE: "TARGET_EMPLOYEE",

  TARGET_ORGANIZATION: "TARGET_ORGANIZATION",
};

// ======================================================
// CORE KEYWORDS
// ======================================================

const CORE = {
  // ==================================================
  // PROCUREMENT
  // ==================================================

  DIRECT: [
    "mời báo giá",
    "mời chào giá",

    "thư mời báo giá",
    "thư mời chào giá",

    "yêu cầu báo giá",
    "đề nghị báo giá",

    "mời cung cấp báo giá",
  ],

  // ==================================================
  // GÓI THẦU
  //
  // Dùng cho SEARCH chính xác.
  //
  // Validation thực tế vẫn bắt được bằng:
  // "mời báo giá", "yêu cầu báo giá"... vì contains().
  // ==================================================

  PACKAGE: [
    "mời báo giá gói thầu",

    "mời chào giá gói thầu",

    "thư mời báo giá gói thầu",

    "thư mời chào giá gói thầu",

    "yêu cầu báo giá gói thầu",

    "đề nghị báo giá gói thầu",

    "mời cung cấp báo giá gói thầu",
  ],

  // ==================================================
  // SELECTION
  // ==================================================

  SELECTION: [
    "lựa chọn đơn vị",

    "lựa chọn nhà cung cấp",

    "lựa chọn đơn vị tổ chức",

    "lựa chọn đơn vị cung cấp",

    "lựa chọn đơn vị thực hiện",
  ],

  // ==================================================
  // SERVICES
  // ==================================================

  TOUR: [
    "du lịch",

    "tour",

    "dịch vụ du lịch",

    "lữ hành",

    "dịch vụ lữ hành",

    "tour du lịch",
  ],

  THAM_QUAN: [
    "tham quan",

    "tham quan du lịch",

    "tham quan học tập",

    "chuyến tham quan",
  ],

  NGHI_DUONG: [
    "nghỉ mát",

    "nghỉ dưỡng",

    "du lịch nghỉ mát",

    "du lịch nghỉ dưỡng",

    "tham quan nghỉ dưỡng",
  ],

  TEAM_BUILDING: [
    "team building",

    "teambuilding",

    "gala",

    "gala dinner",

    "tổ chức sự kiện",
  ],

  VE_NGUON: ["về nguồn", "hành trình về nguồn", "địa chỉ đỏ"],

  // ==================================================
  // TARGET
  // ==================================================

  EMPLOYEE: [
    "người lao động",

    "cán bộ nhân viên",

    "cán bộ viên chức",

    "viên chức",

    "công đoàn",

    "đoàn viên công đoàn",
  ],
};

// ======================================================
// FALLBACK
//
// Chỉ dùng nếu DB không có keyword group tương ứng.
// ======================================================

const FALLBACK = {
  PROCUREMENT_DIRECT: CORE.DIRECT,

  PROCUREMENT_SELECTION: CORE.SELECTION,

  PROCUREMENT_INTEREST: [
    "mời quan tâm",

    "thư mời quan tâm",

    "mời đăng ký",

    "mời đơn vị đăng ký",

    "mời cung cấp hồ sơ năng lực",
  ],

  PROCUREMENT_PLANNING: [
    "kế hoạch tổ chức",

    "kế hoạch tham quan",

    "kế hoạch du lịch",

    "kế hoạch nghỉ mát",

    "kế hoạch nghỉ dưỡng",

    "dự kiến tổ chức",
  ],

  TOUR: CORE.TOUR,

  THAM_QUAN: CORE.THAM_QUAN,

  NGHI_DUONG: CORE.NGHI_DUONG,

  TEAM_BUILDING: CORE.TEAM_BUILDING,

  VE_NGUON: CORE.VE_NGUON,

  EXPANDED_TRAVEL: [
    "du lịch",

    "tour",

    "tour du lịch",

    "tham quan",

    "tham quan du lịch",

    "nghỉ mát",

    "nghỉ dưỡng",

    "lữ hành",

    "dịch vụ lữ hành",

    "team building",
  ],

  TARGET_EMPLOYEE: CORE.EMPLOYEE,

  TARGET_ORGANIZATION: [
    "bệnh viện",

    "trường học",

    "trung tâm y tế",

    "công ty",

    "tổng công ty",

    "công đoàn",

    "cơ quan",

    "đơn vị",
  ],
};

// ======================================================
// CATEGORY CONFIG
// ======================================================

const CATEGORY_CONFIG = [
  {
    category: "TOUR",

    name: "Tour / Du lịch / Lữ hành",

    serviceGroups: [GROUP_CODES.TOUR],

    coreServices: CORE.TOUR,

    targetGroups: [],
  },

  {
    category: "THAM_QUAN",

    name: "Tham quan / Học tập",

    serviceGroups: [GROUP_CODES.THAM_QUAN],

    coreServices: CORE.THAM_QUAN,

    targetGroups: [],
  },

  {
    category: "NGHI_DUONG",

    name: "Nghỉ mát / Nghỉ dưỡng",

    serviceGroups: [GROUP_CODES.NGHI_DUONG],

    coreServices: CORE.NGHI_DUONG,

    targetGroups: [],
  },

  {
    category: "TEAM_BUILDING",

    name: "Team Building / Gala / Event",

    serviceGroups: [GROUP_CODES.TEAM_BUILDING],

    coreServices: CORE.TEAM_BUILDING,

    targetGroups: [],
  },

  {
    category: "VE_NGUON",

    name: "Về nguồn / Địa chỉ đỏ",

    serviceGroups: [GROUP_CODES.VE_NGUON],

    coreServices: CORE.VE_NGUON,

    targetGroups: [GROUP_CODES.TARGET_ORGANIZATION],
  },

  {
    category: "EMPLOYEE_TRAVEL",

    name: "CBNV / Người lao động",

    serviceGroups: [
      GROUP_CODES.TOUR,

      GROUP_CODES.THAM_QUAN,

      GROUP_CODES.NGHI_DUONG,

      GROUP_CODES.EXPANDED_TRAVEL,
    ],

    coreServices: ["du lịch", "tham quan", "nghỉ mát", "nghỉ dưỡng"],

    targetGroups: [GROUP_CODES.TARGET_EMPLOYEE],
  },
];

// ======================================================
// SETTINGS
// ======================================================

const getSetting = async (key, defaultValue = null) => {
  const row = await TenderSetting.findOne({
    where: {
      setting_key: key,
    },

    raw: true,
  });

  return row ? row.setting_value : defaultValue;
};

// ======================================================
// PARSE KEYWORDS
// ======================================================

const parseKeywords = (value) => {
  if (!value) {
    return [];
  }

  if (Array.isArray(value)) {
    return value.map((item) => String(item || "").trim()).filter(Boolean);
  }

  if (typeof value === "string") {
    // JSON array
    try {
      const parsed = JSON.parse(value);

      if (Array.isArray(parsed)) {
        return parsed.map((item) => String(item || "").trim()).filter(Boolean);
      }
    } catch (_) {
      // ignore
    }

    // CSV
    return value
      .split(",")
      .map((item) => item.trim())
      .filter(Boolean);
  }

  return [];
};

// ======================================================
// UNIQUE ARRAY
// ======================================================

const uniqueArray = (items = []) => {
  const seen = new Set();

  const output = [];

  for (const item of items) {
    const value = String(item || "").trim();

    if (!value) {
      continue;
    }

    const key = value.toLowerCase();

    if (seen.has(key)) {
      continue;
    }

    seen.add(key);

    output.push(value);
  }

  return output;
};

// ======================================================
// LOAD DB GROUPS
//
// FIX:
// File cũ overwrite nếu DB có nhiều dòng cùng group_code.
//
// Bản này aggregate toàn bộ keyword.
// ======================================================

const loadKeywordGroups = async () => {
  const rows = await TenderKeywordGroup.findAll({
    where: {
      is_active: true,
    },

    order: [
      ["priority", "ASC"],

      ["id", "ASC"],
    ],

    raw: true,
  });

  const groups = {};

  for (const row of rows) {
    const code = String(row.group_code || "")
      .trim()
      .toUpperCase();

    if (!code) {
      continue;
    }

    if (!groups[code]) {
      groups[code] = {
        ...row,

        keywords: [],
      };
    }

    groups[code].keywords = uniqueArray([
      ...groups[code].keywords,

      ...parseKeywords(row.keywords),
    ]);
  }

  return groups;
};

// ======================================================
// DB GROUP KEYWORDS
// ======================================================

const getDbGroupKeywords = (groups, groupCode) => {
  const code = String(groupCode || "")
    .trim()
    .toUpperCase();

  return groups[code]?.keywords || [];
};

// ======================================================
// DB-FIRST
// ======================================================

const getGroupKeywords = (groups, groupCode) => {
  const code = String(groupCode || "")
    .trim()
    .toUpperCase();

  const db = getDbGroupKeywords(groups, code);

  if (db.length) {
    return db;
  }

  return FALLBACK[code] || [];
};

// ======================================================
// MERGE GROUP KEYWORDS
// ======================================================

const mergeGroupKeywords = (groups, codes = []) => {
  const output = [];

  for (const code of codes) {
    output.push(...getGroupKeywords(groups, code));
  }

  return uniqueArray(output);
};

// ======================================================
// PRIORITIZE CORE
//
// Core keyword luôn đứng đầu.
// Keyword DB vẫn được giữ phía sau.
// ======================================================

const prioritizeCore = (core = [], dbKeywords = []) => {
  return uniqueArray([...core, ...dbKeywords]);
};

// ======================================================
// ROTATION
// ======================================================

const getDailyRotationOffset = () => {
  const now = new Date();

  const start = new Date(now.getFullYear(), 0, 0);

  return Math.floor((now - start) / 86400000);
};

const rotateArray = (array = [], offset = 0) => {
  if (!array.length) {
    return [];
  }

  const index = ((offset % array.length) + array.length) % array.length;

  return [...array.slice(index), ...array.slice(0, index)];
};

// ======================================================
// CURRENT YEAR
// ======================================================

const getCurrentYear = () => {
  return new Date().getFullYear();
};

// ======================================================
// QUOTE PHRASE
// ======================================================

const quotePhrase = (value) => {
  const clean = String(value || "")
    .replace(/"/g, "")
    .trim();

  return clean ? `"${clean}"` : "";
};

// ======================================================
// BUILD OR BLOCK
// ======================================================

const buildOrBlock = (items = [], maxItems = 3, quote = true) => {
  const selected = uniqueArray(items).slice(0, maxItems);

  if (!selected.length) {
    return "";
  }

  const formatted = selected.map((item) => (quote ? quotePhrase(item) : item));

  if (formatted.length === 1) {
    return formatted[0];
  }

  return `(${formatted.join(" OR ")})`;
};

// ======================================================
// CATEGORY HELPERS
// ======================================================

const getCategoryServices = (groups, categoryConfig) => {
  const dbServices = mergeGroupKeywords(groups, categoryConfig.serviceGroups);

  return prioritizeCore(
    categoryConfig.coreServices || [],

    dbServices,
  );
};

const getCategoryTargets = (groups, categoryConfig) => {
  return mergeGroupKeywords(
    groups,

    categoryConfig.targetGroups || [],
  );
};

// ======================================================
// PROCUREMENT ACTIONS
// ======================================================

const getDirectActions = (groups) => {
  return prioritizeCore(
    CORE.DIRECT,

    getGroupKeywords(
      groups,

      GROUP_CODES.PROCUREMENT_DIRECT,
    ),
  );
};

const getSelectionActions = (groups) => {
  return prioritizeCore(
    CORE.SELECTION,

    getGroupKeywords(
      groups,

      GROUP_CODES.PROCUREMENT_SELECTION,
    ),
  );
};

const getInterestActions = (groups) => {
  return getGroupKeywords(
    groups,

    GROUP_CODES.PROCUREMENT_INTEREST,
  );
};

const getPlanningActions = (groups) => {
  return getGroupKeywords(
    groups,

    GROUP_CODES.PROCUREMENT_PLANNING,
  );
};

// ======================================================
// ALL PROCUREMENT KEYWORDS
// ======================================================

const getAllProcurementKeywords = (groups) => {
  return uniqueArray([
    ...CORE.DIRECT,

    ...CORE.PACKAGE,

    ...getDirectActions(groups),

    ...getSelectionActions(groups),

    ...getInterestActions(groups),
  ]);
};

// ======================================================
// ALL SERVICE KEYWORDS
// ======================================================

const getAllServiceKeywords = (groups) => {
  const output = [];

  for (const config of CATEGORY_CONFIG) {
    output.push(...getCategoryServices(groups, config));
  }

  return uniqueArray(output);
};

// ======================================================
// CREATE QUERY
// ======================================================

const createQuery = ({
  key,

  name,

  category,

  intent = "DISCOVERY",

  q,

  validationActions = [],

  validationServices = [],

  validationTargets = [],

  searchActions = [],

  searchServices = [],

  searchTargets = [],

  withYear = false,
}) => {
  return {
    key,

    name,

    category,

    intent,

    q: String(q || "")
      .replace(/\s+/g, " ")
      .trim(),

    pageDepth: 1,

    source: "DB_FIRST_MAX_RECALL",

    withYear,

    searchActions,

    searchServices,

    searchTargets,

    validation: {
      intent,

      actionKeywords: uniqueArray(validationActions),

      serviceKeywords: uniqueArray(validationServices),

      targetKeywords: uniqueArray(validationTargets),
    },
  };
};

// ======================================================
// BUILD SIMPLE QUERY
// ======================================================

const buildSimpleQuery = ({
  key,

  name,

  category,

  actions,

  services,

  targets = [],

  actionIndex = 0,

  serviceIndex = 0,

  targetIndex = 0,

  actionCount = 2,

  serviceCount = 1,

  targetCount = 0,

  useYear = false,

  year,

  validationActions,

  validationServices,

  validationTargets = [],
}) => {
  const actionList = rotateArray(actions, actionIndex).slice(0, actionCount);

  const serviceList = rotateArray(services, serviceIndex).slice(
    0,
    serviceCount,
  );

  const targetList = rotateArray(targets, targetIndex).slice(0, targetCount);

  const parts = [];

  if (actionList.length) {
    parts.push(buildOrBlock(actionList, actionCount, true));
  }

  if (serviceList.length) {
    parts.push(buildOrBlock(serviceList, serviceCount, false));
  }

  if (targetList.length) {
    parts.push(buildOrBlock(targetList, targetCount, true));
  }

  if (useYear) {
    parts.push(String(year));
  }

  return createQuery({
    key,

    name,

    category,

    q: parts.filter(Boolean).join(" "),

    validationActions,

    validationServices,

    validationTargets,

    searchActions: actionList,

    searchServices: serviceList,

    searchTargets: targetList,

    withYear: useYear,
  });
};

// ======================================================
// BUILD PACKAGE QUERY
//
// Dành riêng cho:
//
// - mời báo giá gói thầu
// - yêu cầu báo giá gói thầu
// - thư mời chào giá gói thầu
//
// Không dùng gói thầu đứng riêng.
//
// Luôn phải đi cùng travel service.
// ======================================================

const buildPackageQuery = ({
  key,
  name,
  category,
  services,
  validationActions,
  validationServices,
  validationTargets = [],
  useYear = false,
  year,
}) => {
  const actionBlock = buildOrBlock(
    [
      "mời báo giá",
      "mời chào giá",

      "thư mời báo giá",
      "thư mời chào giá",

      "yêu cầu báo giá",
      "đề nghị báo giá",

      "mời cung cấp báo giá",
    ],
    7,
    true,
  );

  const packageBlock = buildOrBlock(["gói thầu", "gói dịch vụ"], 2, true);

  const serviceBlock = buildOrBlock(services, services.length, true);

  const parts = [actionBlock, packageBlock, serviceBlock];

  if (useYear) {
    parts.push(String(year));
  }

  return createQuery({
    key,
    name,
    category,

    q: parts.filter(Boolean).join(" "),

    validationActions,
    validationServices,
    validationTargets,

    searchActions: [
      "mời báo giá",
      "mời chào giá",
      "thư mời báo giá",
      "thư mời chào giá",
      "yêu cầu báo giá",
      "đề nghị báo giá",
      "mời cung cấp báo giá",
    ],

    searchServices: services,

    withYear: useYear,
  });
};

// ======================================================
// BUILD TENDER QUERIES
// ======================================================

const buildTenderQueries = async () => {
  const groups = await loadKeywordGroups();

  const currentYear = getCurrentYear();

  const maxQueries =
    Number(
      await getSetting(
        "TENDER_MAX_GENERATED_QUERIES",

        String(DEFAULT_MAX_QUERIES),
      ),
    ) || DEFAULT_MAX_QUERIES;

  const allActions = getAllProcurementKeywords(groups);

  const allServices = getAllServiceKeywords(groups);

  // ==================================================
  // CATEGORY CONFIG
  // ==================================================

  const tour = CATEGORY_CONFIG.find((item) => item.category === "TOUR");

  const thamQuan = CATEGORY_CONFIG.find(
    (item) => item.category === "THAM_QUAN",
  );

  const nghiDuong = CATEGORY_CONFIG.find(
    (item) => item.category === "NGHI_DUONG",
  );

  const team = CATEGORY_CONFIG.find(
    (item) => item.category === "TEAM_BUILDING",
  );

  const employee = CATEGORY_CONFIG.find(
    (item) => item.category === "EMPLOYEE_TRAVEL",
  );

  // ==================================================
  // SERVICES
  // ==================================================

  const tourServices = getCategoryServices(groups, tour);

  const thamQuanServices = getCategoryServices(groups, thamQuan);

  const nghiDuongServices = getCategoryServices(groups, nghiDuong);

  const teamServices = getCategoryServices(groups, team);

  const employeeServices = getCategoryServices(groups, employee);

  const employeeTargets = prioritizeCore(
    CORE.EMPLOYEE,

    getCategoryTargets(groups, employee),
  );

  const strongActions = [
    "mời báo giá",

    "mời chào giá",

    "thư mời báo giá",

    "thư mời chào giá",
  ];

  const requestActions = [
    "thư mời báo giá",

    "thư mời chào giá",

    "yêu cầu báo giá",

    "đề nghị báo giá",
  ];

  const queries = [];

  // ==================================================
  // 1. TOUR - MỜI BÁO GIÁ
  // ==================================================

  queries.push(
    buildSimpleQuery({
      key: "RADAR_TOUR_01",

      name: "Tour - mời báo giá",

      category: "TOUR",

      actions: ["mời báo giá", "mời chào giá"],

      services: ["du lịch"],

      actionCount: 2,

      serviceCount: 1,

      validationActions: allActions,

      validationServices: allServices,
    }),
  );

  // ==================================================
  // 2. TOUR - THƯ MỜI / YÊU CẦU
  // ==================================================

  queries.push(
    buildSimpleQuery({
      key: "RADAR_TOUR_02",

      name: "Tour - thư mời / yêu cầu",

      category: "TOUR",

      actions: requestActions,

      services: ["tour"],

      actionCount: 4,

      serviceCount: 1,

      validationActions: allActions,

      validationServices: allServices,
    }),
  );

  // ==================================================
  // 3. TOUR + YEAR
  // ==================================================

  queries.push(
    buildSimpleQuery({
      key: "RADAR_TOUR_YEAR_01",

      name: `Tour ${currentYear}`,

      category: "TOUR",

      actions: strongActions,

      services: ["du lịch"],

      actionCount: 4,

      serviceCount: 1,

      useYear: true,

      year: currentYear,

      validationActions: allActions,

      validationServices: allServices,
    }),
  );

  // ==================================================
  // 4. THAM QUAN
  // ==================================================

  queries.push(
    buildSimpleQuery({
      key: "RADAR_THAM_QUAN_01",

      name: "Tham quan - mời báo giá",

      category: "THAM_QUAN",

      actions: ["mời báo giá", "mời chào giá"],

      services: ["tham quan"],

      actionCount: 2,

      serviceCount: 1,

      validationActions: allActions,

      validationServices: allServices,
    }),
  );

  // ==================================================
  // 5. THAM QUAN - THƯ MỜI / YÊU CẦU
  // ==================================================

  queries.push(
    buildSimpleQuery({
      key: "RADAR_THAM_QUAN_ACTION_02",

      name: "Tham quan - thư mời / yêu cầu",

      category: "THAM_QUAN",

      actions: requestActions,

      services: ["tham quan"],

      actionCount: 4,

      serviceCount: 1,

      validationActions: allActions,

      validationServices: allServices,
    }),
  );

  // ==================================================
  // 6. THAM QUAN + YEAR
  // ==================================================

  queries.push(
    buildSimpleQuery({
      key: "RADAR_THAM_QUAN_YEAR_01",

      name: `Tham quan ${currentYear}`,

      category: "THAM_QUAN",

      actions: strongActions,

      services: ["tham quan"],

      actionCount: 4,

      serviceCount: 1,

      useYear: true,

      year: currentYear,

      validationActions: allActions,

      validationServices: allServices,
    }),
  );

  // ==================================================
  // 7. GÓI THẦU - DU LỊCH / TOUR
  //
  // THAY RADAR_NGHI_MAT_01
  // ==================================================

  queries.push(
    buildPackageQuery({
      key: "RADAR_GOI_THAU_TOUR_01",

      name: "Gói thầu - du lịch / tour",

      category: "TOUR",

      services: ["du lịch", "tour du lịch", "dịch vụ du lịch"],

      validationActions: allActions,

      validationServices: allServices,
    }),
  );

  // ==================================================
  // 8. NGHỈ DƯỠNG
  //
  // Giữ vì vẫn có khả năng tìm riêng.
  // ==================================================

  queries.push(
    buildSimpleQuery({
      key: "RADAR_NGHI_DUONG_01",

      name: "Nghỉ dưỡng - báo giá",

      category: "NGHI_DUONG",

      actions: ["mời báo giá", "mời chào giá"],

      services: ["nghỉ dưỡng"],

      actionCount: 2,

      serviceCount: 1,

      validationActions: allActions,

      validationServices: allServices,
    }),
  );

  // ==================================================
  // 9. GÓI THẦU - THAM QUAN / NGHỈ DƯỠNG
  //
  // THAY RADAR_NGHI_DUONG_YEAR_01
  // ==================================================

  queries.push(
    buildPackageQuery({
      key: "RADAR_GOI_THAU_THAM_QUAN_01",

      name: "Gói thầu - tham quan / nghỉ dưỡng",

      category: "THAM_QUAN",

      services: ["tham quan", "nghỉ dưỡng", "nghỉ mát", "tham quan nghỉ dưỡng"],

      validationActions: allActions,

      validationServices: allServices,
    }),
  );

  // ==================================================
  // 10. NGƯỜI LAO ĐỘNG
  // ==================================================

  queries.push(
    buildSimpleQuery({
      key: "RADAR_EMPLOYEE_01",

      name: "Người lao động - du lịch",

      category: "EMPLOYEE_TRAVEL",

      actions: ["mời báo giá", "mời chào giá"],

      services: ["du lịch"],

      targets: ["người lao động"],

      actionCount: 2,

      serviceCount: 1,

      targetCount: 1,

      validationActions: allActions,

      validationServices: allServices,

      validationTargets: employeeTargets,
    }),
  );

  // ==================================================
  // 11. CÁN BỘ NHÂN VIÊN
  // ==================================================

  queries.push(
    buildSimpleQuery({
      key: "RADAR_EMPLOYEE_02",

      name: "Cán bộ nhân viên",

      category: "EMPLOYEE_TRAVEL",

      actions: ["mời báo giá", "mời chào giá"],

      services: ["tham quan"],

      targets: ["cán bộ nhân viên"],

      actionCount: 2,

      serviceCount: 1,

      targetCount: 1,

      validationActions: allActions,

      validationServices: allServices,

      validationTargets: employeeTargets,
    }),
  );

  // ==================================================
  // 12. EMPLOYEE + YEAR
  // ==================================================

  queries.push(
    buildSimpleQuery({
      key: "RADAR_EMPLOYEE_YEAR_01",

      name: `CBNV / Người lao động ${currentYear}`,

      category: "EMPLOYEE_TRAVEL",

      actions: strongActions,

      services: ["du lịch"],

      targets: ["người lao động"],

      actionCount: 4,

      serviceCount: 1,

      targetCount: 1,

      useYear: true,

      year: currentYear,

      validationActions: allActions,

      validationServices: allServices,

      validationTargets: employeeTargets,
    }),
  );

  // ==================================================
  // 13. GÓI THẦU - LỮ HÀNH
  //
  // THAY TEAM BUILDING YEAR.
  //
  // Team building vừa rồi gần như toàn skip.
  // ==================================================

  queries.push(
    buildPackageQuery({
      key: "RADAR_GOI_THAU_LU_HANH_01",

      name: "Gói thầu - dịch vụ lữ hành",

      category: "TOUR",

      services: ["lữ hành", "dịch vụ lữ hành", "dịch vụ du lịch"],

      validationActions: allActions,

      validationServices: allServices,
    }),
  );

  // ==================================================
  // 14. DỊCH VỤ DU LỊCH + YEAR
  // ==================================================

  queries.push(
    buildSimpleQuery({
      key: "RADAR_DICH_VU_DU_LICH_YEAR_01",

      name: `Dịch vụ du lịch ${currentYear}`,

      category: "TOUR",

      actions: strongActions,

      services: ["dịch vụ du lịch"],

      actionCount: 4,

      serviceCount: 1,

      useYear: true,

      year: currentYear,

      validationActions: allActions,

      validationServices: allServices,
    }),
  );

  // ==================================================
  // 15. TOUR DU LỊCH + YEAR
  // ==================================================

  queries.push(
    buildSimpleQuery({
      key: "RADAR_TOUR_DU_LICH_YEAR_01",

      name: `Tour du lịch ${currentYear}`,

      category: "TOUR",

      actions: strongActions,

      services: ["tour du lịch"],

      actionCount: 4,

      serviceCount: 1,

      useYear: true,

      year: currentYear,

      validationActions: allActions,

      validationServices: allServices,
    }),
  );

  // ==================================================
  // 16. LỮ HÀNH + YEAR
  // ==================================================

  queries.push(
    buildSimpleQuery({
      key: "RADAR_LU_HANH_YEAR_01",

      name: `Dịch vụ lữ hành ${currentYear}`,

      category: "TOUR",

      actions: strongActions,

      services: ["dịch vụ lữ hành"],

      actionCount: 4,

      serviceCount: 1,

      useYear: true,

      year: currentYear,

      validationActions: allActions,

      validationServices: allServices,
    }),
  );

  // ==================================================
  // 17. THAM QUAN DU LỊCH + YEAR
  // ==================================================

  queries.push(
    buildSimpleQuery({
      key: "RADAR_THAM_QUAN_DU_LICH_YEAR_01",

      name: `Tham quan du lịch ${currentYear}`,

      category: "THAM_QUAN",

      actions: strongActions,

      services: ["tham quan du lịch"],

      actionCount: 4,

      serviceCount: 1,

      useYear: true,

      year: currentYear,

      validationActions: allActions,

      validationServices: allServices,
    }),
  );

  // ==================================================
  // 18. THAM QUAN NGHỈ DƯỠNG + YEAR
  // ==================================================

  queries.push(
    buildSimpleQuery({
      key: "RADAR_THAM_QUAN_NGHI_DUONG_YEAR_01",

      name: `Tham quan nghỉ dưỡng ${currentYear}`,

      category: "NGHI_DUONG",

      actions: strongActions,

      services: ["tham quan nghỉ dưỡng"],

      actionCount: 4,

      serviceCount: 1,

      useYear: true,

      year: currentYear,

      validationActions: allActions,

      validationServices: allServices,
    }),
  );

  // ==================================================
  // LIMIT
  // ==================================================

  return queries.filter((query) => query?.q).slice(0, maxQueries);
};

// ======================================================
// FIND QUERY BY KEY
// ======================================================

const findTenderQueryByKey = async (queryKey) => {
  const queries = await buildTenderQueries();

  const key = String(queryKey || "")
    .trim()
    .toUpperCase();

  return (
    queries.find(
      (query) =>
        String(query.key || "")
          .trim()
          .toUpperCase() === key,
    ) || null
  );
};

// ======================================================
// EXPORT
// ======================================================

module.exports = {
  DEFAULT_MAX_QUERIES,

  GROUP_CODES,

  CORE,

  FALLBACK,

  CATEGORY_CONFIG,

  getSetting,

  parseKeywords,

  uniqueArray,

  loadKeywordGroups,

  getDbGroupKeywords,

  getGroupKeywords,

  mergeGroupKeywords,

  prioritizeCore,

  getDailyRotationOffset,

  rotateArray,

  getCurrentYear,

  quotePhrase,

  buildOrBlock,

  getCategoryServices,

  getCategoryTargets,

  getDirectActions,

  getSelectionActions,

  getInterestActions,

  getPlanningActions,

  getAllProcurementKeywords,

  getAllServiceKeywords,

  createQuery,

  buildSimpleQuery,

  buildPackageQuery,

  buildTenderQueries,

  findTenderQueryByKey,
};
