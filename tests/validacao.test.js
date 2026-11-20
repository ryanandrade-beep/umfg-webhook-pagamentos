const { test, describe } = require("node:test");
const assert = require("node:assert/strict");

const { validarNovoPagamento, validarEvento, validarConsulta, idValido } = require("../src/validacao");

const ID = "55555555-5555-4555-8555-555555555555";

describe("validarNovoPagamento", () => {
    test("aceita dados corretos", () => {
        assert.deepEqual(validarNovoPagamento({ cliente: "Ana", valor: 10.5 }), []);
    });

    test("aceita valor mínimo e máximo", () => {
        assert.deepEqual(validarNovoPagamento({ cliente: "Ana", valor: 0.01 }), []);
        assert.deepEqual(validarNovoPagamento({ cliente: "Ana", valor: 99999999.99 }), []);
    });

    test("rejeita cliente com mais de 255 caracteres", () => {
        assert.equal(validarNovoPagamento({ cliente: "a".repeat(256), valor: 1 }).length, 1);
    });

    test("rejeita NaN, Infinity e null", () => {
        for (const valor of [NaN, Infinity, null, undefined]) {
            assert.equal(validarNovoPagamento({ cliente: "Ana", valor }).length, 1);
        }
    });

    test("acumula todos os erros", () => {
        assert.equal(validarNovoPagamento({}).length, 2);
        assert.equal(validarNovoPagamento(null).length, 2);
    });
});

describe("validarEvento", () => {
    test("aceita evento correto", () => {
        assert.deepEqual(validarEvento({ pagamentoId: ID, status: "approved", eventoId: "e1" }), []);
    });

    test("rejeita eventoId com mais de 100 caracteres", () => {
        assert.equal(validarEvento({ pagamentoId: ID, status: "approved", eventoId: "e".repeat(101) }).length, 1);
    });

    test("rejeita tipos errados", () => {
        assert.equal(validarEvento({ pagamentoId: 1, status: 2, eventoId: 3 }).length, 3);
    });
});

describe("validarConsulta", () => {
    test("usa valores padrão", () => {
        const { erros, filtros } = validarConsulta({});
        assert.deepEqual(erros, []);
        assert.equal(filtros.limite, 20);
        assert.equal(filtros.pagina, 1);
    });

    test("rejeita limite acima de 100 e página decimal", () => {
        assert.equal(validarConsulta({ limite: "101" }).erros.length, 1);
        assert.equal(validarConsulta({ pagina: "1.5" }).erros.length, 1);
    });
});

describe("idValido", () => {
    test("reconhece UUID", () => {
        assert.equal(idValido(ID), true);
        assert.equal(idValido("abc"), false);
        assert.equal(idValido(undefined), false);
    });
});
