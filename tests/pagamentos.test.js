const { test, before, after, describe } = require("node:test");
const assert = require("node:assert/strict");

const { app, request, prepararBanco, criarPagamento, enviarWebhook, executar, fechar } = require("./helpers");

before(prepararBanco);
after(fechar);

describe("criação de pagamentos", () => {
    test("cria cobrança pendente e persiste no MySQL", async () => {
        const resposta = await request(app).post("/pagamentos").send({ cliente: "  Ana Silva ", valor: 49.9 });

        assert.equal(resposta.status, 201);
        assert.equal(resposta.body.pagamento.cliente, "Ana Silva");
        assert.equal(resposta.body.pagamento.valor, 49.9);
        assert.equal(resposta.body.pagamento.status, "pending");

        const [linhas] = await executar("SELECT cliente, valor, status FROM pagamentos WHERE id = ?", [
            resposta.body.pagamento.id
        ]);
        assert.equal(linhas.length, 1);
        assert.equal(linhas[0].status, "pending");
    });

    const invalidos = [
        ["sem corpo", undefined],
        ["cliente vazio", { cliente: "   ", valor: 10 }],
        ["cliente não é texto", { cliente: 123, valor: 10 }],
        ["valor zero", { cliente: "Ana", valor: 0 }],
        ["valor negativo", { cliente: "Ana", valor: -5 }],
        ["valor como texto", { cliente: "Ana", valor: "10" }],
        ["valor com 3 casas decimais", { cliente: "Ana", valor: 10.123 }],
        ["valor acima do limite", { cliente: "Ana", valor: 1e12 }]
    ];

    for (const [nome, corpo] of invalidos) {
        test(`rejeita dados inválidos: ${nome}`, async () => {
            const resposta = await request(app).post("/pagamentos").send(corpo);
            assert.equal(resposta.status, 400);
            assert.ok(resposta.body.erro);
        });
    }

    test("rejeita JSON malformado com 400", async () => {
        const resposta = await request(app)
            .post("/pagamentos")
            .set("Content-Type", "application/json")
            .send("{cliente:");
        assert.equal(resposta.status, 400);
    });
});

describe("consulta de pagamentos", () => {
    test("busca cobrança pelo identificador", async () => {
        const criado = await criarPagamento("Bruno", 20);
        const resposta = await request(app).get(`/pagamentos/${criado.id}`);

        assert.equal(resposta.status, 200);
        assert.equal(resposta.body.id, criado.id);
        assert.equal(resposta.body.cliente, "Bruno");
    });

    test("retorna 404 para identificador inexistente", async () => {
        const resposta = await request(app).get("/pagamentos/11111111-1111-4111-8111-111111111111");
        assert.equal(resposta.status, 404);
    });

    test("retorna 400 para identificador malformado", async () => {
        const resposta = await request(app).get("/pagamentos/abc");
        assert.equal(resposta.status, 400);
    });

    test("lista pagamentos e filtra por status", async () => {
        await executar("DELETE FROM eventos_webhook");
        await executar("DELETE FROM pagamentos");
        const a = await criarPagamento("A", 10);
        await criarPagamento("B", 20);
        await executar("UPDATE pagamentos SET status = 'approved' WHERE id = ?", [a.id]);

        const todos = await request(app).get("/pagamentos");
        assert.equal(todos.status, 200);
        assert.equal(todos.body.total, 2);

        const aprovados = await request(app).get("/pagamentos?status=approved");
        assert.equal(aprovados.body.total, 1);
        assert.equal(aprovados.body.pagamentos[0].id, a.id);

        const pendentes = await request(app).get("/pagamentos?status=pending");
        assert.equal(pendentes.body.pagamentos.length, 1);
        assert.equal(pendentes.body.pagamentos[0].cliente, "B");
    });

    test("pagina a listagem", async () => {
        const resposta = await request(app).get("/pagamentos?limite=1&pagina=2");
        assert.equal(resposta.status, 200);
        assert.equal(resposta.body.pagamentos.length, 1);
        assert.equal(resposta.body.total, 2);
    });

    test("rejeita status e paginação inválidos com 400", async () => {
        assert.equal((await request(app).get("/pagamentos?status=xyz")).status, 400);
        assert.equal((await request(app).get("/pagamentos?limite=0")).status, 400);
        assert.equal((await request(app).get("/pagamentos?pagina=abc")).status, 400);
    });
});

describe("filtros avançados", () => {
    before(async () => {
        await executar("DELETE FROM eventos_webhook");
        await executar("DELETE FROM pagamentos");
        await criarPagamento("Ana Silva", 10);
        await criarPagamento("Bruno Souza", 50);
        await criarPagamento("Ana Paula 100%", 120.5);
        const antigo = await criarPagamento("Carla Antiga", 75);
        await executar("UPDATE pagamentos SET criado_em = '2026-01-15 12:00:00.000' WHERE id = ?", [antigo.id]);
    });

    const clientes = (resposta) => resposta.body.pagamentos.map((p) => p.cliente).sort();

    test("filtra por nome do cliente (parcial, sem diferenciar maiúsculas)", async () => {
        const resposta = await request(app).get("/pagamentos?cliente=ana");
        assert.equal(resposta.status, 200);
        assert.deepEqual(clientes(resposta), ["Ana Paula 100%", "Ana Silva"]);
    });

    test("trata % e _ do nome como texto literal", async () => {
        const resposta = await request(app).get("/pagamentos?cliente=" + encodeURIComponent("100%"));
        assert.deepEqual(clientes(resposta), ["Ana Paula 100%"]);
        const curinga = await request(app).get("/pagamentos?cliente=" + encodeURIComponent("%"));
        assert.deepEqual(clientes(curinga), ["Ana Paula 100%"]);
    });

    test("filtra por valor mínimo e máximo", async () => {
        const min = await request(app).get("/pagamentos?valorMin=75");
        assert.deepEqual(clientes(min), ["Ana Paula 100%", "Carla Antiga"]);

        const faixa = await request(app).get("/pagamentos?valorMin=10&valorMax=50");
        assert.deepEqual(clientes(faixa), ["Ana Silva", "Bruno Souza"]);
    });

    test("filtra por período de criação (inclui o dia final inteiro)", async () => {
        const hoje = new Date().toISOString().slice(0, 10);

        const recentes = await request(app).get(`/pagamentos?de=${hoje}&ate=${hoje}`);
        assert.equal(recentes.body.total, 3);

        const antigos = await request(app).get("/pagamentos?de=2026-01-01&ate=2026-01-15");
        assert.deepEqual(clientes(antigos), ["Carla Antiga"]);
    });

    test("combina vários filtros", async () => {
        const resposta = await request(app).get("/pagamentos?cliente=ana&valorMax=50&status=pending");
        assert.deepEqual(clientes(resposta), ["Ana Silva"]);
    });

    test("rejeita filtros inválidos com 400", async () => {
        for (const consulta of [
            "valorMin=abc",
            "valorMin=-1",
            "valorMin=10&valorMax=5",
            "de=15/01/2026",
            "de=2026-02-31",
            "de=2026-02-10&ate=2026-02-01"
        ]) {
            const resposta = await request(app).get(`/pagamentos?${consulta}`);
            assert.equal(resposta.status, 400, consulta);
        }
    });
});

describe("histórico de eventos", () => {
    test("lista os eventos processados de um pagamento", async () => {
        const pagamento = await criarPagamento("Eventos", 5);
        await enviarWebhook({ pagamentoId: pagamento.id, status: "approved", eventoId: "evt-historico" });

        const resposta = await request(app).get(`/pagamentos/${pagamento.id}/eventos`);
        assert.equal(resposta.status, 200);
        assert.equal(resposta.body.eventos.length, 1);
        assert.equal(resposta.body.eventos[0].eventoId, "evt-historico");
        assert.equal(resposta.body.eventos[0].status, "approved");
    });

    test("retorna 404 e 400 para pagamento inexistente ou id inválido", async () => {
        assert.equal((await request(app).get("/pagamentos/66666666-6666-4666-8666-666666666666/eventos")).status, 404);
        assert.equal((await request(app).get("/pagamentos/abc/eventos")).status, 400);
    });
});

describe("rotas gerais", () => {
    test("rota inexistente retorna 404 em JSON", async () => {
        const resposta = await request(app).get("/nao-existe");
        assert.equal(resposta.status, 404);
        assert.ok(resposta.body.erro);
    });

    test("rota de saúde responde online", async () => {
        const resposta = await request(app).get("/saude");
        assert.equal(resposta.status, 200);
        assert.equal(resposta.body.status, "online");
    });
});
