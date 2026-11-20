const { test, before, after, describe } = require("node:test");
const assert = require("node:assert/strict");

const { app, request, prepararBanco, criarPagamento, enviarWebhook, executar, fechar } = require("./helpers");

before(prepararBanco);
after(fechar);

describe("atualização de status por webhook", () => {
    test("aprova o pagamento e registra o evento no banco", async () => {
        const pagamento = await criarPagamento();
        const resposta = await enviarWebhook({ pagamentoId: pagamento.id, status: "approved", eventoId: "evt-1" });

        assert.equal(resposta.status, 200);
        assert.equal(resposta.body.duplicado, false);
        assert.equal(resposta.body.pagamento.status, "approved");
        assert.ok(resposta.body.pagamento.atualizadoEm);

        const consulta = await request(app).get(`/pagamentos/${pagamento.id}`);
        assert.equal(consulta.body.status, "approved");

        const [eventos] = await executar("SELECT * FROM eventos_webhook WHERE evento_id = 'evt-1'");
        assert.equal(eventos.length, 1);
        assert.equal(eventos[0].pagamento_id, pagamento.id);
    });

    for (const status of ["rejected", "cancelled"]) {
        test(`aceita o status ${status}`, async () => {
            const pagamento = await criarPagamento();
            const resposta = await enviarWebhook({
                pagamentoId: pagamento.id,
                status,
                eventoId: `evt-${status}-${pagamento.id}`
            });
            assert.equal(resposta.status, 200);
            assert.equal(resposta.body.pagamento.status, status);
        });
    }

    test("status persiste após reiniciar a conexão com o banco", async () => {
        const pagamento = await criarPagamento();
        await enviarWebhook({ pagamentoId: pagamento.id, status: "approved", eventoId: "evt-persistencia" });

        await fechar();

        const consulta = await request(app).get(`/pagamentos/${pagamento.id}`);
        assert.equal(consulta.body.status, "approved");
    });

    test("retorna 404 quando o pagamento não existe", async () => {
        const resposta = await enviarWebhook({
            pagamentoId: "22222222-2222-4222-8222-222222222222",
            status: "approved",
            eventoId: "evt-inexistente"
        });
        assert.equal(resposta.status, 404);
    });

    test("retorna 409 ao alterar pagamento já finalizado e não registra o evento", async () => {
        const pagamento = await criarPagamento();
        await enviarWebhook({ pagamentoId: pagamento.id, status: "approved", eventoId: "evt-final-1" });

        const resposta = await enviarWebhook({ pagamentoId: pagamento.id, status: "cancelled", eventoId: "evt-final-2" });
        assert.equal(resposta.status, 409);

        const [eventos] = await executar("SELECT * FROM eventos_webhook WHERE evento_id = 'evt-final-2'");
        assert.equal(eventos.length, 0);
    });
});

describe("eventos duplicados", () => {
    test("o mesmo evento enviado duas vezes é processado uma única vez", async () => {
        const pagamento = await criarPagamento();
        const corpo = { pagamentoId: pagamento.id, status: "approved", eventoId: "evt-duplicado" };

        const primeira = await enviarWebhook(corpo);
        const segunda = await enviarWebhook(corpo);

        assert.equal(primeira.status, 200);
        assert.equal(primeira.body.duplicado, false);
        assert.equal(segunda.status, 200);
        assert.equal(segunda.body.duplicado, true);

        const [eventos] = await executar("SELECT * FROM eventos_webhook WHERE evento_id = 'evt-duplicado'");
        assert.equal(eventos.length, 1);
    });

    test("evento duplicado não sobrescreve o status já aplicado", async () => {
        const pagamento = await criarPagamento();
        await enviarWebhook({ pagamentoId: pagamento.id, status: "approved", eventoId: "evt-sobrescrita" });

        const repetido = await enviarWebhook({ pagamentoId: pagamento.id, status: "cancelled", eventoId: "evt-sobrescrita" });
        assert.equal(repetido.body.duplicado, true);

        const consulta = await request(app).get(`/pagamentos/${pagamento.id}`);
        assert.equal(consulta.body.status, "approved");
    });

    test("envios simultâneos do mesmo evento resultam em um único processamento", async () => {
        const pagamento = await criarPagamento();
        const corpo = { pagamentoId: pagamento.id, status: "approved", eventoId: "evt-concorrente" };

        const respostas = await Promise.all(Array.from({ length: 5 }, () => enviarWebhook(corpo)));

        assert.equal(respostas.filter((r) => r.status === 200 && r.body.duplicado === false).length, 1);
        assert.equal(respostas.filter((r) => r.body.duplicado === true).length, 4);

        const [eventos] = await executar("SELECT * FROM eventos_webhook WHERE evento_id = 'evt-concorrente'");
        assert.equal(eventos.length, 1);
    });
});

describe("segurança e validação do webhook", () => {
    test("recusa token inválido com 401", async () => {
        const pagamento = await criarPagamento();
        const resposta = await enviarWebhook(
            { pagamentoId: pagamento.id, status: "approved", eventoId: "evt-token" },
            "token-errado"
        );
        assert.equal(resposta.status, 401);

        const consulta = await request(app).get(`/pagamentos/${pagamento.id}`);
        assert.equal(consulta.body.status, "pending");
    });

    test("recusa requisição sem token com 401", async () => {
        const resposta = await enviarWebhook({ pagamentoId: "x", status: "approved", eventoId: "e" }, null);
        assert.equal(resposta.status, 401);
    });

    const invalidos = [
        ["sem corpo", undefined],
        ["pagamentoId ausente", { status: "approved", eventoId: "e1" }],
        ["pagamentoId que não é UUID", { pagamentoId: "123", status: "approved", eventoId: "e1" }],
        ["status inválido", { pagamentoId: "33333333-3333-4333-8333-333333333333", status: "reject", eventoId: "e1" }],
        ["status pending não é evento", { pagamentoId: "33333333-3333-4333-8333-333333333333", status: "pending", eventoId: "e1" }],
        ["eventoId ausente", { pagamentoId: "33333333-3333-4333-8333-333333333333", status: "approved" }],
        ["eventoId vazio", { pagamentoId: "33333333-3333-4333-8333-333333333333", status: "approved", eventoId: " " }]
    ];

    for (const [nome, corpo] of invalidos) {
        test(`rejeita dados inválidos: ${nome}`, async () => {
            const resposta = await enviarWebhook(corpo);
            assert.equal(resposta.status, 400);
        });
    }
});

describe("simulação pela interface", () => {
    test("simula recebimento e atualiza o status", async () => {
        const pagamento = await criarPagamento();
        const resposta = await request(app).post("/simulacao/webhook").send({ pagamentoId: pagamento.id });

        assert.equal(resposta.status, 200);
        assert.equal(resposta.body.pagamento.status, "approved");
    });

    test("retorna 404 para pagamento inexistente", async () => {
        const resposta = await request(app)
            .post("/simulacao/webhook")
            .send({ pagamentoId: "44444444-4444-4444-8444-444444444444" });
        assert.equal(resposta.status, 404);
    });
});
