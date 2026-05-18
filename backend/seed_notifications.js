const pool = require('./db');

async function seed() {
    try {
        const notifications = [
            "System Maintenance scheduled for Friday at 10 PM.",
            "New feature: You can now export your schedule to PDF.",
            "Reminder: Submit your timesheets by end of week.",
            "Welcome to the updated Schedule Management System!"
        ];

        for (const msg of notifications) {
            await pool.query('INSERT INTO notifications (message) VALUES (?)', [msg]);
        }
        
        console.log("Successfully added 4 placeholder notifications.");
        process.exit(0);
    } catch (err) {
        console.error("Failed to seed notifications", err);
        process.exit(1);
    }
}

seed();
