const mysql = require('mysql2/promise');
require('dotenv').config();

async function check() {
    const pool = mysql.createPool({
        host: process.env.DB_HOST || 'localhost',
        user: process.env.DB_USER || 'root',
        password: process.env.DB_PASSWORD || '',
        database: process.env.DB_NAME || 'schedule_manager',
    });

    const [rows] = await pool.query('SELECT event_id, title, span_id FROM events ORDER BY event_id DESC LIMIT 10');
    console.log(rows);
    process.exit(0);
}

check();
