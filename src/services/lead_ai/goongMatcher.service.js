/**
 * Chuẩn hóa text để so tên.
 */
function normalizeText(value = "") {
  return String(value)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/đ/g, "d")
    .replace(/Đ/g, "D")
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Bỏ các từ pháp lý để so tên dễ hơn.
 */
function normalizeCompanyName(value = "") {
  return normalizeText(value)
    .replace(/\bcong ty\b/g, " ")
    .replace(/\btnhh\b/g, " ")
    .replace(/\btrach nhiem huu han\b/g, " ")
    .replace(/\bco phan\b/g, " ")
    .replace(/\bmot thanh vien\b/g, " ")
    .replace(/\bmtv\b/g, " ")
    .replace(/\bcompany\b/g, " ")
    .replace(/\bco ltd\b/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function similarity(a, b) {
  const first = normalizeCompanyName(a);

  const second = normalizeCompanyName(b);

  if (!first || !second) {
    return 0;
  }

  if (first === second) {
    return 1;
  }

  if (first.includes(second) || second.includes(first)) {
    return 0.9;
  }

  const aWords = new Set(first.split(" "));

  const bWords = new Set(second.split(" "));

  const intersection = [...aWords].filter((word) => bWords.has(word)).length;

  const union = new Set([...aWords, ...bWords]).size;

  if (!union) {
    return 0;
  }

  return intersection / union;
}

/**
 * Haversine.
 */
function getDistanceMeters(lat1, lng1, lat2, lng2) {
  if (lat1 == null || lng1 == null || lat2 == null || lng2 == null) {
    return null;
  }

  const R = 6371000;

  const toRad = (value) => (Number(value) * Math.PI) / 180;

  const dLat = toRad(Number(lat2) - Number(lat1));

  const dLng = toRad(Number(lng2) - Number(lng1));

  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;

  return Math.round(R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a)));
}

/**
 * Lấy tên prediction.
 */
function getPredictionName(prediction = {}) {
  return (
    prediction?.structured_formatting?.main_text ||
    prediction.main_text ||
    prediction.description ||
    ""
  );
}

/**
 * Chấm điểm prediction Goong so với HERE.
 */
function calculateMatchScore(company, prediction) {
  let score = 0;

  const predictionName = getPredictionName(prediction);

  const nameSimilarity = similarity(company.name, predictionName);

  /**
   * TÊN: tối đa 60
   */
  if (nameSimilarity >= 0.9) {
    score += 60;
  } else if (nameSimilarity >= 0.7) {
    score += 50;
  } else if (nameSimilarity >= 0.5) {
    score += 35;
  } else if (nameSimilarity >= 0.3) {
    score += 15;
  }

  /**
   * TỈNH: +20
   */
  const hereProvince = normalizeText(company.province);

  const goongProvince = normalizeText(prediction?.compound?.province || "");

  if (
    hereProvince &&
    goongProvince &&
    (hereProvince.includes(goongProvince) ||
      goongProvince.includes(hereProvince))
  ) {
    score += 20;
  }

  /**
   * ĐỊA CHỈ: +20
   */
  const hereAddress = normalizeText(company.formatted_address);

  const goongAddress = normalizeText(prediction.description);

  if (hereAddress && goongAddress) {
    const addressWords = goongAddress
      .split(" ")
      .filter((word) => word.length >= 4);

    const matched = addressWords.filter((word) =>
      hereAddress.includes(word),
    ).length;

    if (addressWords.length > 0) {
      const ratio = matched / addressWords.length;

      if (ratio >= 0.6) {
        score += 20;
      } else if (ratio >= 0.3) {
        score += 10;
      }
    }
  }

  return Math.min(score, 100);
}

function findBestPrediction(company, predictions = []) {
  let best = null;

  for (const prediction of predictions) {
    const score = calculateMatchScore(company, prediction);

    if (!best || score > best.matchScore) {
      best = {
        prediction,
        matchScore: score,
      };
    }
  }

  return best;
}

module.exports = {
  normalizeText,
  normalizeCompanyName,
  similarity,
  getDistanceMeters,
  calculateMatchScore,
  findBestPrediction,
};
