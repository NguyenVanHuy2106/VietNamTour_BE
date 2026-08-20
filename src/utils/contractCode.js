const sequelize = require("../config/database");

const generateContractCode = async (transaction = null) => {
  const [results] = await sequelize.query(
    `
        SELECT nextval(
          'vntour.vn_contract_number_seq'
        ) AS contract_number
      `,
    {
      transaction,
    },
  );

  const contractNumber = Number(results[0].contract_number);

  const year = new Date().getFullYear();

  return `${contractNumber}/VNT-TSA${year}`;
};

module.exports = {
  generateContractCode,
};
