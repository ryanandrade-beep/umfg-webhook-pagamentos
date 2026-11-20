const crypto = require("node:crypto");
const { executar } = require("./database");

const COLUNAS = "id, cliente, valor, status, criado_em, atualizado_em";

function paraPagamento(linha) {
    return {
        id: linha.id,
        cliente: linha.cliente,
        valor: Number(linha.valor),
        status: linha.status,
        criadoEm: linha.criado_em ? new Date(linha.criado_em).toISOString() : null,
        atualizadoEm: linha.atualizado_em ? new Date(linha.atualizado_em).toISOString() : null
    };
}

async function criarPagamento(cliente, valor) {
    const id = crypto.randomUUID();

    await executar(
        `INSERT INTO pagamentos (id, cliente, valor, status, criado_em)
         VALUES (?, ?, ?, 'pending', UTC_TIMESTAMP(3))`,
        [id, cliente, valor]
    );

    return buscarPagamento(id);
}

async function buscarPagamento(id) {
    const [linhas] = await executar(`SELECT ${COLUNAS} FROM pagamentos WHERE id = ?`, [id]);
    return linhas.length ? paraPagamento(linhas[0]) : null;
}

async function listarPagamentos({ status, limite, pagina }) {
    const filtro = status ? "WHERE status = ?" : "";
    const valores = status ? [status] : [];

    const [[{ total }]] = await executar(
        `SELECT COUNT(*) AS total FROM pagamentos ${filtro}`,
        valores
    );

    const deslocamento = (pagina - 1) * limite;
    const [linhas] = await executar(
        `SELECT ${COLUNAS} FROM pagamentos ${filtro}
         ORDER BY criado_em DESC, id LIMIT ${Number(limite)} OFFSET ${Number(deslocamento)}`,
        valores
    );

    return { total: Number(total), pagamentos: linhas.map(paraPagamento) };
}

module.exports = { criarPagamento, buscarPagamento, listarPagamentos, paraPagamento, COLUNAS };
