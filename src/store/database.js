const mysql = require("mysql2/promise");

let pool;

function configuracao() {
    return {
        host: process.env.MYSQL_HOST || "localhost",
        port: Number(process.env.MYSQL_PORT || 3306),
        user: process.env.MYSQL_USER || "root",
        password: process.env.MYSQL_PASSWORD || "",
        database: process.env.MYSQL_DATABASE
    };
}

function getPool() {
    if (!pool) {
        pool = mysql.createPool({
            ...configuracao(),
            waitForConnections: true,
            connectionLimit: 10,
            decimalNumbers: true,
            timezone: "Z"
        });
    }
    return pool;
}

async function executar(sql, valores = []) {
    return getPool().execute(sql, valores);
}

async function comTransacao(trabalho) {
    const connection = await getPool().getConnection();
    try {
        await connection.beginTransaction();
        const resultado = await trabalho(connection);
        await connection.commit();
        return resultado;
    } catch (error) {
        await connection.rollback();
        throw error;
    } finally {
        connection.release();
    }
}

async function fechar() {
    if (pool) {
        const atual = pool;
        pool = undefined;
        await atual.end();
    }
}

module.exports = { executar, comTransacao, fechar, configuracao };
