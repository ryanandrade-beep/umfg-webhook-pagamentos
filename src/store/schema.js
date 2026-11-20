const fs = require("node:fs");
const path = require("node:path");
const mysql = require("mysql2/promise");

const { configuracao } = require("./database");

async function inicializarBanco() {
    const { database, ...conexao } = configuracao();
    if (!database || !/^[A-Za-z0-9_]+$/.test(database)) {
        throw new Error("MYSQL_DATABASE ausente ou inválido.");
    }

    const connection = await mysql.createConnection({ ...conexao, multipleStatements: true });
    try {
        await connection.query(`CREATE DATABASE IF NOT EXISTS \`${database}\``);
        await connection.query(`USE \`${database}\``);
        const sql = fs.readFileSync(path.join(__dirname, "..", "..", "database.sql"), "utf8");
        await connection.query(sql);
    } finally {
        await connection.end();
    }
}

module.exports = { inicializarBanco };
