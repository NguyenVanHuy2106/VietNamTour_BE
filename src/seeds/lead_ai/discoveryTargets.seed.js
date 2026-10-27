const { DiscoveryTarget } = require("../../models/lead_ai");

const areas = [
  // =========================================================
  // TP. HỒ CHÍ MINH
  // =========================================================

  // ---------------------------------------------------------
  // TP. THỦ ĐỨC
  // Chia nhiều vùng vì Thủ Đức rất rộng
  // ---------------------------------------------------------

  {
    province: "TP. Hồ Chí Minh",
    district: "Thành phố Thủ Đức",
    latitude: 10.8494,
    longitude: 106.7537,
    radius: 5000,
  },

  {
    province: "TP. Hồ Chí Minh",
    district: "Thành phố Thủ Đức",
    latitude: 10.8026,
    longitude: 106.7383,
    radius: 4500,
  },

  {
    province: "TP. Hồ Chí Minh",
    district: "Thành phố Thủ Đức",
    latitude: 10.87,
    longitude: 106.803,
    radius: 5000,
  },

  {
    province: "TP. Hồ Chí Minh",
    district: "Thành phố Thủ Đức",
    latitude: 10.842,
    longitude: 106.827,
    radius: 5000,
  },

  // ---------------------------------------------------------
  // KHU TRUNG TÂM
  // ---------------------------------------------------------

  {
    province: "TP. Hồ Chí Minh",
    district: "Quận 1",
    latitude: 10.7756,
    longitude: 106.7009,
    radius: 3000,
  },

  {
    province: "TP. Hồ Chí Minh",
    district: "Quận 3",
    latitude: 10.7844,
    longitude: 106.6844,
    radius: 3000,
  },

  {
    province: "TP. Hồ Chí Minh",
    district: "Quận 4",
    latitude: 10.7578,
    longitude: 106.7013,
    radius: 3000,
  },

  {
    province: "TP. Hồ Chí Minh",
    district: "Quận 5",
    latitude: 10.754,
    longitude: 106.663,
    radius: 3000,
  },

  {
    province: "TP. Hồ Chí Minh",
    district: "Quận 6",
    latitude: 10.7469,
    longitude: 106.635,
    radius: 3500,
  },

  {
    province: "TP. Hồ Chí Minh",
    district: "Quận 7",
    latitude: 10.734,
    longitude: 106.7216,
    radius: 4500,
  },

  {
    province: "TP. Hồ Chí Minh",
    district: "Quận 8",
    latitude: 10.724,
    longitude: 106.6285,
    radius: 4500,
  },

  {
    province: "TP. Hồ Chí Minh",
    district: "Quận 10",
    latitude: 10.7732,
    longitude: 106.667,
    radius: 3000,
  },

  {
    province: "TP. Hồ Chí Minh",
    district: "Quận 11",
    latitude: 10.7639,
    longitude: 106.6434,
    radius: 3000,
  },

  {
    province: "TP. Hồ Chí Minh",
    district: "Quận 12",
    latitude: 10.8635,
    longitude: 106.654,
    radius: 5000,
  },

  // ---------------------------------------------------------
  // BÌNH THẠNH
  // ---------------------------------------------------------

  {
    province: "TP. Hồ Chí Minh",
    district: "Bình Thạnh",
    latitude: 10.8106,
    longitude: 106.7091,
    radius: 4000,
  },

  // ---------------------------------------------------------
  // PHÚ NHUẬN
  // ---------------------------------------------------------

  {
    province: "TP. Hồ Chí Minh",
    district: "Phú Nhuận",
    latitude: 10.799,
    longitude: 106.6803,
    radius: 3000,
  },

  // ---------------------------------------------------------
  // TÂN BÌNH
  // ---------------------------------------------------------

  {
    province: "TP. Hồ Chí Minh",
    district: "Tân Bình",
    latitude: 10.8014,
    longitude: 106.6526,
    radius: 4000,
  },

  // ---------------------------------------------------------
  // GÒ VẤP
  // ---------------------------------------------------------

  {
    province: "TP. Hồ Chí Minh",
    district: "Gò Vấp",
    latitude: 10.8387,
    longitude: 106.6653,
    radius: 4500,
  },

  // ---------------------------------------------------------
  // TÂN PHÚ
  // ---------------------------------------------------------

  {
    province: "TP. Hồ Chí Minh",
    district: "Tân Phú",
    latitude: 10.7916,
    longitude: 106.6273,
    radius: 4000,
  },

  // ---------------------------------------------------------
  // BÌNH TÂN
  // Bình Tân khá rộng nên chia 2 vùng
  // ---------------------------------------------------------

  {
    province: "TP. Hồ Chí Minh",
    district: "Bình Tân",
    latitude: 10.7658,
    longitude: 106.6034,
    radius: 4500,
  },

  {
    province: "TP. Hồ Chí Minh",
    district: "Bình Tân",
    latitude: 10.815,
    longitude: 106.6,
    radius: 4500,
  },

  // ---------------------------------------------------------
  // HÓC MÔN
  // ---------------------------------------------------------

  {
    province: "TP. Hồ Chí Minh",
    district: "Hóc Môn",
    latitude: 10.8864,
    longitude: 106.5925,
    radius: 6000,
  },

  {
    province: "TP. Hồ Chí Minh",
    district: "Hóc Môn",
    latitude: 10.833,
    longitude: 106.58,
    radius: 5000,
  },

  // ---------------------------------------------------------
  // BÌNH CHÁNH
  // Rộng nên chia 3 điểm
  // ---------------------------------------------------------

  {
    province: "TP. Hồ Chí Minh",
    district: "Bình Chánh",
    latitude: 10.6685,
    longitude: 106.568,
    radius: 6500,
  },

  {
    province: "TP. Hồ Chí Minh",
    district: "Bình Chánh",
    latitude: 10.73,
    longitude: 106.59,
    radius: 6000,
  },

  {
    province: "TP. Hồ Chí Minh",
    district: "Bình Chánh",
    latitude: 10.78,
    longitude: 106.57,
    radius: 5500,
  },

  // ---------------------------------------------------------
  // NHÀ BÈ
  // ---------------------------------------------------------

  {
    province: "TP. Hồ Chí Minh",
    district: "Nhà Bè",
    latitude: 10.6953,
    longitude: 106.7049,
    radius: 5500,
  },

  {
    province: "TP. Hồ Chí Minh",
    district: "Nhà Bè",
    latitude: 10.63,
    longitude: 106.74,
    radius: 6000,
  },

  // ---------------------------------------------------------
  // CỦ CHI
  // Cực rộng nên chia 3 điểm
  // ---------------------------------------------------------

  {
    province: "TP. Hồ Chí Minh",
    district: "Củ Chi",
    latitude: 10.9733,
    longitude: 106.4933,
    radius: 7000,
  },

  {
    province: "TP. Hồ Chí Minh",
    district: "Củ Chi",
    latitude: 11.05,
    longitude: 106.51,
    radius: 7000,
  },

  {
    province: "TP. Hồ Chí Minh",
    district: "Củ Chi",
    latitude: 11.115,
    longitude: 106.46,
    radius: 7000,
  },

  // ---------------------------------------------------------
  // CẦN GIỜ
  // Mật độ doanh nghiệp thấp nhưng diện tích rất lớn
  // ---------------------------------------------------------

  {
    province: "TP. Hồ Chí Minh",
    district: "Cần Giờ",
    latitude: 10.411,
    longitude: 106.9547,
    radius: 7000,
  },

  {
    province: "TP. Hồ Chí Minh",
    district: "Cần Giờ",
    latitude: 10.505,
    longitude: 106.88,
    radius: 7000,
  },

  // =========================================================
  // BÌNH DƯƠNG
  // GIỮ NGUYÊN
  // =========================================================

  {
    province: "Bình Dương",
    district: "Thủ Dầu Một",
    latitude: 10.9804,
    longitude: 106.6519,
    radius: 5000,
  },

  {
    province: "Bình Dương",
    district: "Thuận An",
    latitude: 10.931,
    longitude: 106.7114,
    radius: 5000,
  },

  {
    province: "Bình Dương",
    district: "Dĩ An",
    latitude: 10.9068,
    longitude: 106.7694,
    radius: 5000,
  },

  // =========================================================
  // ĐỒNG NAI
  // GIỮ NGUYÊN
  // =========================================================

  {
    province: "Đồng Nai",
    district: "Biên Hòa",
    latitude: 10.9574,
    longitude: 106.8426,
    radius: 6000,
  },

  // =========================================================
  // TIỀN GIANG
  // =========================================================

  {
    province: "Tiền Giang",
    district: "Mỹ Tho",
    latitude: 10.36,
    longitude: 106.359,
    radius: 6000,
  },

  {
    province: "Tiền Giang",
    district: "Cai Lậy",
    latitude: 10.405,
    longitude: 106.119,
    radius: 5000,
  },

  {
    province: "Tiền Giang",
    district: "Gò Công",
    latitude: 10.3608,
    longitude: 106.672,
    radius: 5000,
  },

  // =========================================================
  // VĨNH LONG
  // =========================================================

  {
    province: "Vĩnh Long",
    district: "Vĩnh Long",
    latitude: 10.2537,
    longitude: 105.9722,
    radius: 6000,
  },

  {
    province: "Vĩnh Long",
    district: "Long Hồ",
    latitude: 10.196,
    longitude: 105.947,
    radius: 5000,
  },

  {
    province: "Vĩnh Long",
    district: "Bình Minh",
    latitude: 10.068,
    longitude: 105.822,
    radius: 5000,
  },

  // =========================================================
  // ĐỒNG THÁP
  // =========================================================

  {
    province: "Đồng Tháp",
    district: "Cao Lãnh",
    latitude: 10.455,
    longitude: 105.634,
    radius: 6000,
  },

  {
    province: "Đồng Tháp",
    district: "Sa Đéc",
    latitude: 10.29,
    longitude: 105.756,
    radius: 5000,
  },

  {
    province: "Đồng Tháp",
    district: "Hồng Ngự",
    latitude: 10.802,
    longitude: 105.34,
    radius: 5000,
  },

  // =========================================================
  // HẬU GIANG
  // =========================================================

  {
    province: "Hậu Giang",
    district: "Vị Thanh",
    latitude: 9.783,
    longitude: 105.47,
    radius: 6000,
  },

  {
    province: "Hậu Giang",
    district: "Ngã Bảy",
    latitude: 9.813,
    longitude: 105.82,
    radius: 5000,
  },

  {
    province: "Hậu Giang",
    district: "Châu Thành",
    latitude: 9.93,
    longitude: 105.81,
    radius: 5000,
  },

  // =========================================================
  // CẦN THƠ
  // =========================================================

  {
    province: "Cần Thơ",
    district: "Ninh Kiều",
    latitude: 10.034,
    longitude: 105.788,
    radius: 6000,
  },

  {
    province: "Cần Thơ",
    district: "Cái Răng",
    latitude: 10.0,
    longitude: 105.785,
    radius: 5000,
  },

  {
    province: "Cần Thơ",
    district: "Ô Môn",
    latitude: 10.11,
    longitude: 105.625,
    radius: 5000,
  },

  // =========================================================
  // BẾN TRE
  // =========================================================

  {
    province: "Bến Tre",
    district: "Bến Tre",
    latitude: 10.2415,
    longitude: 106.3759,
    radius: 6000,
  },

  // =========================================================
  // TRÀ VINH
  // =========================================================

  {
    province: "Trà Vinh",
    district: "Trà Vinh",
    latitude: 9.9347,
    longitude: 106.3453,
    radius: 6000,
  },

  // =========================================================
  // SÓC TRĂNG
  // =========================================================

  {
    province: "Sóc Trăng",
    district: "Sóc Trăng",
    latitude: 9.6025,
    longitude: 105.9739,
    radius: 6000,
  },

  // =========================================================
  // AN GIANG
  // =========================================================

  {
    province: "An Giang",
    district: "Long Xuyên",
    latitude: 10.386,
    longitude: 105.4352,
    radius: 6000,
  },

  {
    province: "An Giang",
    district: "Châu Đốc",
    latitude: 10.7007,
    longitude: 105.1167,
    radius: 5000,
  },

  // =========================================================
  // KIÊN GIANG
  // =========================================================

  {
    province: "Kiên Giang",
    district: "Rạch Giá",
    latitude: 10.0125,
    longitude: 105.0809,
    radius: 6000,
  },

  // =========================================================
  // BẠC LIÊU
  // =========================================================

  {
    province: "Bạc Liêu",
    district: "Bạc Liêu",
    latitude: 9.294,
    longitude: 105.7216,
    radius: 6000,
  },

  // =========================================================
  // CÀ MAU
  // =========================================================

  {
    province: "Cà Mau",
    district: "Cà Mau",
    latitude: 9.1769,
    longitude: 105.1524,
    radius: 6000,
  },
];

const keywords = [
  "công ty",
  "công ty sản xuất",
  "công ty thương mại",
  "công ty logistics",
  "công ty xuất nhập khẩu",
  "công ty công nghệ",
  "công ty phần mềm",
  "công ty xây dựng",
  "công ty thực phẩm",
  "công ty dược",
  "công ty điện tử",
  "công ty cơ khí",
  "công ty may mặc",
  "nhà máy",
  "xí nghiệp",
];

async function seedDiscoveryTargets() {
  let created = 0;
  let updated = 0;

  for (const area of areas) {
    for (const keyword of keywords) {
      const [target, wasCreated] = await DiscoveryTarget.findOrCreate({
        where: {
          province: area.province,
          district: area.district,
          keyword,
          search_type: "TEXT_SEARCH",
        },

        defaults: {
          province: area.province,
          district: area.district,
          keyword,

          latitude: area.latitude,
          longitude: area.longitude,
          radius: area.radius,

          search_type: "TEXT_SEARCH",
          status: "READY",
          priority: 5,
          scan_count: 0,
        },
      });

      if (wasCreated) {
        created++;
      } else {
        await target.update({
          latitude: area.latitude,
          longitude: area.longitude,
          radius: area.radius,
          status: "READY",
          next_scan_at: null,
        });

        updated++;
      }
    }
  }

  console.log(`[Lead AI Seed] Created: ${created}, Updated: ${updated}`);
}

module.exports = {
  seedDiscoveryTargets,
};
