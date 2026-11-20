require("dotenv").config({ quiet: true });

process.env.MYSQL_DATABASE = process.env.MYSQL_TEST_DATABASE || "webhook_test";
process.env.WEBHOOK_TOKEN = "token-de-teste";

const request = require("supertest");

const app = require("../src/app");
const { inicializarBanco } = require("../src/store/schema");
const { executar, fechar } = require("../src/store/database");

const TOKEN = process.env.WEBHOOK_TOKEN;

async function prepararBanco() {
    await inicializarBanco();
    await executar("DELETE FROM eventos_webhook");
    await executar("DELETE FROM pagamentos");
}

async function criarPagamento(cliente = "Ana Silva", valor = 50) {
    const resposta = await request(app).post("/pagamentos").send({ cliente, valor });
    return resposta.body.pagamento;
}

function enviarWebhook(corpo, token = TOKEN) {
    const req = request(app).post("/webhook/pagamento");
    if (token !== null) {
        req.set("x-webhook-token", token);
    }
    return req.send(corpo);
}

module.exports = { app, request, prepararBanco, criarPagamento, enviarWebhook, executar, fechar, TOKEN };
