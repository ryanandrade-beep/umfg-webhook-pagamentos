require("dotenv").config();

const { inicializarBanco } = require("../src/store/schema");
const { fechar } = require("../src/store/database");

inicializarBanco()
    .then(() => {
        console.log(`Banco "${process.env.MYSQL_DATABASE}" pronto.`);
    })
    .catch((error) => {
        console.error("Falha ao preparar o banco:", error.message);
        process.exitCode = 1;
    })
    .finally(fechar);
