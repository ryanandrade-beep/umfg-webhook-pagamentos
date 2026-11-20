const express = require("express");

const { criarPagamento, buscarPagamento, listarPagamentos, listarEventos } = require("../store/paymentStore");
const { validarNovoPagamento, validarConsulta, idValido } = require("../validacao");

const router = express.Router();

router.post("/", async (req, res, next) => {
    const erros = validarNovoPagamento(req.body);
    if (erros.length) {
        return res.status(400).json({ erro: "Dados inválidos", detalhes: erros });
    }

    try {
        const pagamento = await criarPagamento(req.body.cliente.trim(), req.body.valor);
        return res.status(201).json({ mensagem: "Pagamento criado", pagamento });
    } catch (error) {
        next(error);
    }
});

router.get("/", async (req, res, next) => {
    const { erros, filtros } = validarConsulta(req.query);
    if (erros.length) {
        return res.status(400).json({ erro: "Parâmetros inválidos", detalhes: erros });
    }

    try {
        const { total, pagamentos } = await listarPagamentos(filtros);
        return res.json({ total, pagina: filtros.pagina, limite: filtros.limite, pagamentos });
    } catch (error) {
        next(error);
    }
});

router.get("/:id", async (req, res, next) => {
    if (!idValido(req.params.id)) {
        return res.status(400).json({ erro: "Identificador de pagamento inválido" });
    }

    try {
        const pagamento = await buscarPagamento(req.params.id);
        if (!pagamento) {
            return res.status(404).json({ erro: "Pagamento não encontrado" });
        }
        return res.json(pagamento);
    } catch (error) {
        next(error);
    }
});

router.get("/:id/eventos", async (req, res, next) => {
    if (!idValido(req.params.id)) {
        return res.status(400).json({ erro: "Identificador de pagamento inválido" });
    }

    try {
        const pagamento = await buscarPagamento(req.params.id);
        if (!pagamento) {
            return res.status(404).json({ erro: "Pagamento não encontrado" });
        }
        return res.json({ pagamentoId: pagamento.id, eventos: await listarEventos(pagamento.id) });
    } catch (error) {
        next(error);
    }
});

module.exports = router;
