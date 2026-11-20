const { comTransacao } = require("../store/database");
const { paraPagamento, COLUNAS } = require("../store/paymentStore");

const STATUS_FINAIS = ["approved", "rejected", "cancelled"];

async function processarEvento({ pagamentoId, status, eventoId }) {
    return comTransacao(async (connection) => {
        const [linhas] = await connection.execute(
            `SELECT ${COLUNAS} FROM pagamentos WHERE id = ? FOR UPDATE`,
            [pagamentoId]
        );

        if (!linhas.length) {
            return { resultado: "nao_encontrado" };
        }

        try {
            await connection.execute(
                `INSERT INTO eventos_webhook (evento_id, pagamento_id, status, processado_em)
                 VALUES (?, ?, ?, UTC_TIMESTAMP(3))`,
                [eventoId, pagamentoId, status]
            );
        } catch (error) {
            if (error.code === "ER_DUP_ENTRY") {
                return { resultado: "duplicado", pagamento: paraPagamento(linhas[0]) };
            }
            throw error;
        }

        if (linhas[0].status !== "pending") {
            const erro = new Error("Pagamento já finalizado");
            erro.codigo = "FINALIZADO";
            erro.pagamento = paraPagamento(linhas[0]);
            throw erro;
        }

        await connection.execute(
            "UPDATE pagamentos SET status = ?, atualizado_em = UTC_TIMESTAMP(3) WHERE id = ?",
            [status, pagamentoId]
        );

        const [atualizado] = await connection.execute(
            `SELECT ${COLUNAS} FROM pagamentos WHERE id = ?`,
            [pagamentoId]
        );

        return { resultado: "processado", pagamento: paraPagamento(atualizado[0]) };
    });
}

module.exports = { processarEvento, STATUS_FINAIS };
