const userRoutes = require("./user.routes");
const servicesRoutes = require("./services.routes");
const tourTypeRoutes = require("./tourType.routes");
const collectionRoutes = require("./collection.routes");
const customerRoutes = require("./customer.routes");
const provinceRoutes = require("./province.routes");
const travelLocationRoutes = require("./travelLocation.routes");
const hotelTypeRoutes = require("./hotelType.routes");
const vehicleTypeRoutes = require("./vehicleType.routes");
const timeTypeRoutes = require("./timeType.routes");
const bannerRoutes = require("./banner.routes");
const tourRoutes = require("./tour.routes");

module.exports = [
  userRoutes,
  servicesRoutes,
  tourTypeRoutes,
  collectionRoutes,
  customerRoutes,
  provinceRoutes,
  travelLocationRoutes,
  hotelTypeRoutes,
  vehicleTypeRoutes,
  timeTypeRoutes,
  bannerRoutes,
  tourRoutes,
];
