require("dotenv").config();

const app = require("./src/app");
const { fechar } = require("./src/store/database");

const port = Number(process.env.PORT) || 5000;
const server = app.listen(port, () => {
    console.log(`Servidor rodando em http://localhost:${port}`);
});

async function encerrar() {
    server.close();
    await fechar();
    process.exit(0);
}

process.on("SIGINT", encerrar);
process.on("SIGTERM", encerrar);
