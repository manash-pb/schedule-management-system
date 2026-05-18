const pool = require('./db');

async function alterTables() {
    try {
        await pool.query(`
            ALTER TABLE notifications 
            ADD COLUMN attachment_name VARCHAR(255) NULL AFTER attachment_path
        `);
        console.log('Successfully added attachment_name column to notifications table.');
        process.exit(0);
    } catch (error) {
        console.error('Error altering table to add attachment_name:', error);
        process.exit(1);
    }
}

alterTables();
