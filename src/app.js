const express = require("express");
const path = require("node:path");

const paymentRoutes = require("./routes/paymentRoutes");
const webhookRoutes = require("./routes/webhookRoutes");
const simulacaoRoutes = require("./routes/simulacaoRoutes");

const app = express();

app.use(express.json());
app.use(express.static(path.join(__dirname, "public")));

app.get("/", (req, res) => {
    res.sendFile(path.join(__dirname, "public", "index.html"));
});

app.use("/pagamentos", paymentRoutes);
app.use("/webhook", webhookRoutes);
app.use("/simulacao", simulacaoRoutes);

app.use((req, res) => {
    res.status(404).json({ erro: "Rota não encontrada" });
});

app.use((error, req, res, next) => {
    if (error.type === "entity.parse.failed") {
        return res.status(400).json({ erro: "JSON inválido" });
    }
    if (error.type === "entity.too.large") {
        return res.status(413).json({ erro: "Corpo da requisição muito grande" });
    }
    console.error(error);
    return res.status(500).json({ erro: "Erro interno do servidor" });
});

module.exports = app;
