const crypto = require("node:crypto");
const express = require("express");

const { validarEvento } = require("../validacao");
const { processarEvento } = require("../services/webhookService");

const router = express.Router();

function tokenConfere(recebido) {
    const esperado = process.env.WEBHOOK_TOKEN || "new-token";
    if (typeof recebido !== "string") {
        return false;
    }
    const a = Buffer.from(recebido);
    const b = Buffer.from(esperado);
    return a.length === b.length && crypto.timingSafeEqual(a, b);
}

function responderEvento(res, resultado) {
    if (resultado.resultado === "nao_encontrado") {
        return res.status(404).json({ erro: "Pagamento não encontrado" });
    }
    if (resultado.resultado === "duplicado") {
        return res.status(200).json({
            mensagem: "Evento já processado",
            duplicado: true,
            pagamento: resultado.pagamento
        });
    }
    return res.status(200).json({
        mensagem: "Webhook processado",
        duplicado: false,
        pagamento: resultado.pagamento
    });
}

router.post("/pagamento", async (req, res, next) => {
    if (!tokenConfere(req.get("x-webhook-token"))) {
        return res.status(401).json({ erro: "Token do webhook inválido" });
    }

    const erros = validarEvento(req.body);
    if (erros.length) {
        return res.status(400).json({ erro: "Dados inválidos", detalhes: erros });
    }

    try {
        const resultado = await processarEvento(req.body);
        return responderEvento(res, resultado);
    } catch (error) {
        if (error.codigo === "FINALIZADO") {
            return res.status(409).json({
                erro: "Pagamento já finalizado",
                pagamento: error.pagamento
            });
        }
        next(error);
    }
});

module.exports = router;
