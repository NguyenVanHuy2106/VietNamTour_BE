const axios = require("axios");

const HERE_DISCOVER_URL = "https://discover.search.hereapi.com/v1/discover";

const HERE_API_KEY = "P1-zrqZTi19uR8LGBXPafL4HqZA7wn2JNNby5gVCU60";

async function searchGooglePlaces({
  textQuery,
  latitude,
  longitude,
  radius = 3000,
  offset = 0,
}) {
  if (!textQuery) {
    throw new Error("textQuery không được để trống");
  }

  if (!HERE_API_KEY) {
    throw new Error("HERE_API_KEY chưa được cấu hình");
  }

  if (latitude == null || longitude == null) {
    throw new Error("Thiếu latitude/longitude cho Discovery Target");
  }

  const params = {
    q: textQuery,

    // HARD FILTER theo bán kính
    in: `circle:${latitude},${longitude};r=${radius}`,

    limit: 100,

    // bật pagination
    offset,

    lang: "vi-VN",

    apiKey: HERE_API_KEY,
  };

  try {
    const response = await axios.get(HERE_DISCOVER_URL, {
      params,
      timeout: 30000,
    });

    const data = response.data || {};
    const items = data.items || [];

    const places = items
      .filter((item) => item.resultType === "place")
      .map((item) => {
        const contact = item.contacts?.[0] || {};

        return {
          id: item.id || null,

          displayName: {
            text: item.title || "Không xác định",
          },

          formattedAddress: item.address?.label || null,

          location: item.position
            ? {
                latitude: item.position.lat,

                longitude: item.position.lng,
              }
            : null,

          primaryType: item.categories?.[0]?.name || null,

          types: item.categories?.map((category) => category.name) || [],

          website: contact.www?.[0]?.value || null,

          phone: contact.phone?.[0]?.value || null,

          email: contact.email?.[0]?.value || null,

          rating: null,

          userRatingCount: 0,

          businessStatus: null,

          googleMapsUri: null,

          sourceProvider: "HERE",

          rawHereData: item,
        };
      });

    return {
      places,

      count: data.count ?? places.length,

      offset: data.offset ?? offset,

      limit: data.limit ?? 100,

      nextOffset: data.nextOffset ?? null,
    };
  } catch (error) {
    console.error(
      "[HERE Discovery] Search error:",
      error.response?.data || error.message,
    );

    throw error;
  }
}

module.exports = {
  searchGooglePlaces,
};
