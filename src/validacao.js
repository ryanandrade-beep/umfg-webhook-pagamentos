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

function dataValida(texto) {
    if (typeof texto !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(texto)) {
        return false;
    }
    const data = new Date(`${texto}T00:00:00Z`);
    return !Number.isNaN(data.getTime()) && data.toISOString().startsWith(texto);
}

function numeroOpcional(texto) {
    if (texto === undefined || texto === "") {
        return undefined;
    }
    return Number(texto);
}

function validarConsulta(query) {
    const erros = [];
    const { status, cliente, de, ate } = query;
    const limite = query.limite === undefined ? 20 : Number(query.limite);
    const pagina = query.pagina === undefined ? 1 : Number(query.pagina);
    const valorMin = numeroOpcional(query.valorMin);
    const valorMax = numeroOpcional(query.valorMax);

    if (status !== undefined && !STATUS_VALIDOS.includes(status)) {
        erros.push(`status deve ser um de: ${STATUS_VALIDOS.join(", ")}`);
    }
    if (cliente !== undefined && (typeof cliente !== "string" || cliente.length > 255)) {
        erros.push("cliente deve ser um texto de até 255 caracteres");
    }
    if (!Number.isInteger(limite) || limite < 1 || limite > 100) {
        erros.push("limite deve ser um inteiro entre 1 e 100");
    }
    if (!Number.isInteger(pagina) || pagina < 1) {
        erros.push("pagina deve ser um inteiro maior ou igual a 1");
    }
    for (const [nome, valor] of [["valorMin", valorMin], ["valorMax", valorMax]]) {
        if (valor !== undefined && (!Number.isFinite(valor) || valor < 0)) {
            erros.push(`${nome} deve ser um número maior ou igual a zero`);
        }
    }
    if (valorMin !== undefined && valorMax !== undefined && valorMin > valorMax) {
        erros.push("valorMin não pode ser maior que valorMax");
    }
    if (de !== undefined && !dataValida(de)) {
        erros.push("de deve estar no formato AAAA-MM-DD");
    }
    if (ate !== undefined && !dataValida(ate)) {
        erros.push("ate deve estar no formato AAAA-MM-DD");
    }
    if (dataValida(de) && dataValida(ate) && de > ate) {
        erros.push("de não pode ser posterior a ate");
    }

    return {
        erros,
        filtros: { status, cliente: cliente?.trim() || undefined, valorMin, valorMax, de, ate, limite, pagina }
    };
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
