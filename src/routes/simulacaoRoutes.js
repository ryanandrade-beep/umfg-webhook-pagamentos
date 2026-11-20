const crypto = require("node:crypto");
const express = require("express");

const { validarEvento } = require("../validacao");
const { processarEvento } = require("../services/webhookService");

const router = express.Router();

router.post("/webhook", async (req, res, next) => {
    const evento = {
        pagamentoId: req.body?.pagamentoId,
        status: req.body?.status ?? "approved",
        eventoId: `sim-${crypto.randomUUID()}`
    };

    const erros = validarEvento(evento);
    if (erros.length) {
        return res.status(400).json({ erro: "Dados inválidos", detalhes: erros });
    }

    try {
        const resultado = await processarEvento(evento);
        if (resultado.resultado === "nao_encontrado") {
            return res.status(404).json({ erro: "Pagamento não encontrado" });
        }
        return res.json({ mensagem: "Notificação simulada processada", pagamento: resultado.pagamento });
    } catch (error) {
        if (error.codigo === "FINALIZADO") {
            return res.status(409).json({ erro: "Pagamento já finalizado", pagamento: error.pagamento });
        }
        next(error);
    }
});

module.exports = router;
