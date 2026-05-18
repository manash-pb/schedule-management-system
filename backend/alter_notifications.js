const pool = require('./db');

async function alterTables() {
    try {
        await pool.query(`
            ALTER TABLE notifications 
            ADD COLUMN subject VARCHAR(255) NULL AFTER id,
            ADD COLUMN attachment_path VARCHAR(255) NULL AFTER message
        `);
        console.log('Successfully altered notifications table.');
        process.exit(0);
    } catch (error) {
        console.error('Error altering table:', error);
        process.exit(1);
    }
}

alterTables();
