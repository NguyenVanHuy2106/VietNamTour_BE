const googlePlacesConfig = {
  apiKey: "AIzaSyCY3WjDmVKvX7syz8r8Ejah-tp9Q7evCjU",

  textSearchUrl: "https://places.googleapis.com/v1/places:searchText",

  languageCode: "vi",
  regionCode: "VN",

  timeout: 30000,
};

if (!googlePlacesConfig.apiKey) {
  throw new Error("GOOGLE_PLACES_API_KEY chưa được cấu hình");
}

module.exports = googlePlacesConfig;
