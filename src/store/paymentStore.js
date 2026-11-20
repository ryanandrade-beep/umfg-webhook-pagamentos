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

function montarFiltro({ status, cliente, valorMin, valorMax, de, ate }) {
    const condicoes = [];
    const valores = [];

    if (status) {
        condicoes.push("status = ?");
        valores.push(status);
    }
    if (cliente) {
        condicoes.push("cliente LIKE ?");
        valores.push(`%${cliente.replace(/[\\%_]/g, "\\$&")}%`);
    }
    if (valorMin !== undefined) {
        condicoes.push("valor >= ?");
        valores.push(valorMin);
    }
    if (valorMax !== undefined) {
        condicoes.push("valor <= ?");
        valores.push(valorMax);
    }
    if (de) {
        condicoes.push("criado_em >= ?");
        valores.push(`${de} 00:00:00.000`);
    }
    if (ate) {
        condicoes.push("criado_em < DATE_ADD(?, INTERVAL 1 DAY)");
        valores.push(`${ate} 00:00:00.000`);
    }

    return { clausula: condicoes.length ? `WHERE ${condicoes.join(" AND ")}` : "", valores };
}

async function listarPagamentos(filtros) {
    const { limite, pagina } = filtros;
    const { clausula, valores } = montarFiltro(filtros);

    const [[{ total }]] = await executar(`SELECT COUNT(*) AS total FROM pagamentos ${clausula}`, valores);

    const deslocamento = (pagina - 1) * limite;
    const [linhas] = await executar(
        `SELECT ${COLUNAS} FROM pagamentos ${clausula}
         ORDER BY criado_em DESC, id LIMIT ${Number(limite)} OFFSET ${Number(deslocamento)}`,
        valores
    );

    return { total: Number(total), pagamentos: linhas.map(paraPagamento) };
}

async function listarEventos(pagamentoId) {
    const [linhas] = await executar(
        `SELECT evento_id, status, processado_em FROM eventos_webhook
         WHERE pagamento_id = ? ORDER BY processado_em, evento_id`,
        [pagamentoId]
    );
    return linhas.map((linha) => ({
        eventoId: linha.evento_id,
        status: linha.status,
        processadoEm: new Date(linha.processado_em).toISOString()
    }));
}

module.exports = { criarPagamento, buscarPagamento, listarPagamentos, listarEventos, paraPagamento, COLUNAS };
