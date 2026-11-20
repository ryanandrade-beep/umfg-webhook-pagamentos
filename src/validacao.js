const STATUS_VALIDOS = ["pending", "approved", "rejected", "cancelled"];
const STATUS_EVENTO = ["approved", "rejected", "cancelled"];
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const VALOR_MAXIMO = 99999999.99;

function textoValido(valor, maximo) {
    return typeof valor === "string" && valor.trim().length > 0 && valor.trim().length <= maximo;
}

function validarNovoPagamento(corpo) {
    const { cliente, valor } = corpo ?? {};
    const erros = [];

    if (!textoValido(cliente, 255)) {
        erros.push("cliente deve ser um texto de 1 a 255 caracteres");
    }
    if (typeof valor !== "number" || !Number.isFinite(valor) || valor <= 0 || valor > VALOR_MAXIMO) {
        erros.push("valor deve ser um número maior que zero");
    } else if (Math.round(valor * 100) / 100 !== valor) {
        erros.push("valor deve ter no máximo 2 casas decimais");
    }

    return erros;
}

function validarEvento(corpo) {
    const { pagamentoId, status, eventoId } = corpo ?? {};
    const erros = [];

    if (typeof pagamentoId !== "string" || !UUID.test(pagamentoId)) {
        erros.push("pagamentoId deve ser um UUID válido");
    }
    if (typeof status !== "string" || !STATUS_EVENTO.includes(status)) {
        erros.push(`status deve ser um de: ${STATUS_EVENTO.join(", ")}`);
    }
    if (!textoValido(eventoId, 100)) {
        erros.push("eventoId deve ser um texto de 1 a 100 caracteres");
    }

    return erros;
}

function validarConsulta(query) {
    const erros = [];
    const { status } = query;
    const limite = query.limite === undefined ? 20 : Number(query.limite);
    const pagina = query.pagina === undefined ? 1 : Number(query.pagina);

    if (status !== undefined && !STATUS_VALIDOS.includes(status)) {
        erros.push(`status deve ser um de: ${STATUS_VALIDOS.join(", ")}`);
    }
    if (!Number.isInteger(limite) || limite < 1 || limite > 100) {
        erros.push("limite deve ser um inteiro entre 1 e 100");
    }
    if (!Number.isInteger(pagina) || pagina < 1) {
        erros.push("pagina deve ser um inteiro maior ou igual a 1");
    }

    return { erros, filtros: { status, limite, pagina } };
}

function idValido(id) {
    return typeof id === "string" && UUID.test(id);
}

module.exports = {
    STATUS_VALIDOS,
    STATUS_EVENTO,
    validarNovoPagamento,
    validarEvento,
    validarConsulta,
    idValido
};
