const { test, before, after, describe } = require("node:test");
const assert = require("node:assert/strict");

const { app, request, prepararBanco, criarPagamento, executar, fechar } = require("./helpers");

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
