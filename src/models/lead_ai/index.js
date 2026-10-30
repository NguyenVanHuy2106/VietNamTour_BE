const Company = require("./company.model");

const DiscoveryTarget = require("./discoveryTarget.model");

const DiscoveryRun = require("./discoveryRun.model");

const CompanySource = require("./companySource.model");

const DiscoveryGridCell = require("./discoveryGridCell.model");

const GoongCompany = require("./goongCompany.model");
const TenderKeywordGroup = require("./tenderKeywordGroup.model");

const TenderSource = require("./tenderSource.model");

const TenderItem = require("./tenderItem.model");

const TenderSearchLog = require("./tenderSearchLog.model");

const TenderSetting = require("./tenderSetting.model");

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

TenderSource.hasMany(TenderItem, {
  foreignKey: "source_id",
  as: "tenderItems",
});

TenderItem.belongsTo(TenderSource, {
  foreignKey: "source_id",
  as: "source",
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
  TenderKeywordGroup,
  TenderSource,
  TenderItem,
  TenderSearchLog,
  TenderSetting,
};
