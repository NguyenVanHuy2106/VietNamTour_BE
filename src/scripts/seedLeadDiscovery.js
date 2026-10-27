require("dotenv").config();

const sequelize = require("../config/database");

const {
  seedDiscoveryTargets,
} = require("../seeds/lead_ai/discoveryTargets.seed");

async function run() {
  try {
    await sequelize.authenticate();

    console.log("[Seed] Database connected.");

    await seedDiscoveryTargets();

    console.log("[Seed] Discovery targets completed.");

    process.exit(0);
  } catch (error) {
    console.error("[Seed] Discovery targets error:", error);

    process.exit(1);
  }
}

run();
