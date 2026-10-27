const axios = require("axios");

const GOONG_API_KEY = "NZFvdIq2qkp5rnodIk9O21Z6VxFMA15vtD4JN1Wp";

const GOONG_BASE_URL = "https://rsapi.goong.io/v2/place";

function checkApiKey() {
  if (!GOONG_API_KEY) {
    throw new Error("Chưa cấu hình GOONG_API_KEY");
  }
}

/**
 * Tìm địa điểm/công ty trên Goong.
 */
async function autocomplete({ input, latitude, longitude }) {
  checkApiKey();

  if (!input) {
    throw new Error("Goong autocomplete thiếu input");
  }

  const params = {
    input,
    api_key: GOONG_API_KEY,

    has_deprecated_administrative_unit: true,
  };

  if (
    latitude !== null &&
    latitude !== undefined &&
    longitude !== null &&
    longitude !== undefined
  ) {
    params.location = `${latitude},${longitude}`;
  }

  const response = await axios.get(`${GOONG_BASE_URL}/autocomplete`, {
    params,
    timeout: 15000,
  });

  if (response.data?.status && response.data.status !== "OK") {
    throw new Error(`Goong Autocomplete: ${response.data.status}`);
  }

  return response.data?.predictions || [];
}

/**
 * Lấy chi tiết địa điểm.
 */
async function placeDetail(placeId) {
  checkApiKey();

  if (!placeId) {
    throw new Error("Thiếu Goong place_id");
  }

  const response = await axios.get(`${GOONG_BASE_URL}/detail`, {
    params: {
      place_id: placeId,

      api_key: GOONG_API_KEY,

      has_deprecated_administrative_unit: true,
    },

    timeout: 15000,
  });

  if (response.data?.status !== "OK") {
    throw new Error(
      `Goong Place Detail: ${response.data?.status || "UNKNOWN_ERROR"}`,
    );
  }

  return response.data?.result || null;
}

module.exports = {
  autocomplete,
  placeDetail,
};
