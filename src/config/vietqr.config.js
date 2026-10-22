const vietqrConfig = {
  clientId: "9c9897bc-3754-416d-85ed-dde379c70943",

  apiKey: "f07a59ad-1e2a-4023-9c67-ac1116c17ada",

  baseUrl: "https://api.vietqr.io",

  endpoints: {
    banks: "/v2/banks",

    lookup: "/v2/lookup",

    generate: "/v2/generate",
  },

  isConfigured() {
    return Boolean(this.clientId && this.apiKey);
  },
};

module.exports = vietqrConfig;
