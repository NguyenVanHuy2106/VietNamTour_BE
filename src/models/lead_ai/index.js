const Company = require("./Company.model");

const DiscoveryTarget = require("./DiscoveryTarget.model");

const DiscoveryRun = require("./DiscoveryRun.model");

const CompanySource = require("./CompanySource.model");

const DiscoveryGridCell = require("./DiscoveryGridCell.model");

const GoongCompany = require("./goongCompany.model");

/**
 * =========================================================
 * ASSOCIATIONS
 * =========================================================
 */

/**
 * Discovery Target -> Discovery Runs
 */
DiscoveryTarget.hasMany(DiscoveryRun, {
  foreignKey: "target_id",

  as: "runs",
});

DiscoveryRun.belongsTo(DiscoveryTarget, {
  foreignKey: "target_id",

  as: "target",
});

/**
 * Company -> Company Sources
 */
Company.hasMany(CompanySource, {
  foreignKey: "company_id",

  as: "sources",
});

CompanySource.belongsTo(Company, {
  foreignKey: "company_id",

  as: "company",
});

Company.hasMany(GoongCompany, {
  foreignKey: "source_company_id",
  as: "goongCompanies",
});

GoongCompany.belongsTo(Company, {
  foreignKey: "source_company_id",
  as: "sourceCompany",
});

/**
 * =========================================================
 * EXPORTS
 * =========================================================
 */

module.exports = {
  Company,

  DiscoveryTarget,

  DiscoveryRun,

  CompanySource,

  DiscoveryGridCell,

  GoongCompany,
};
