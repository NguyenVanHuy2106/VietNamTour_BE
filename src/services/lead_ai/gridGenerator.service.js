function generateGrid({
  centerLat,
  centerLng,

  rows = 3,
  cols = 3,

  spacingKm = 3.5,

  radius = 2500,
}) {
  const cells = [];

  // xấp xỉ:
  // 1 độ latitude ≈ 111 km
  const latStep = spacingKm / 111;

  // longitude phụ thuộc latitude
  const lngStep = spacingKm / (111 * Math.cos((centerLat * Math.PI) / 180));

  const rowOffset = (rows - 1) / 2;

  const colOffset = (cols - 1) / 2;

  for (let row = 0; row < rows; row++) {
    for (let col = 0; col < cols; col++) {
      const latitude = centerLat + (row - rowOffset) * latStep;

      const longitude = centerLng + (col - colOffset) * lngStep;

      cells.push({
        latitude,
        longitude,
        radius,
      });
    }
  }

  return cells;
}

module.exports = {
  generateGrid,
};
