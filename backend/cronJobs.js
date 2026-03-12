// cronJobs.js
const cron = require('node-cron');
const nodemailer = require('nodemailer');
const pool = require('./db');
require('dotenv').config();

// Setup Nodemailer transporter
const transporter = nodemailer.createTransport({
    service: 'gmail', // or use host/port for SendGrid, Mailgun, etc.
    auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS,
    },
});

function startCronJobs() {
    // Schedule task to run every day at 1:00 AM ('0 1 * * *')
    cron.schedule('0 1 * * *', async () => {
        console.log('Running daily email reminder job...');
        
        try {
            // Find events happening today or tomorrow
            const query = `
                SELECT e.title, e.event_date, e.start_time, e.venue, a.email, a.name 
                FROM Events e
                JOIN Event_Attendees ea ON e.event_id = ea.event_id
                JOIN Attendees a ON ea.attendee_id = a.attendee_id
                WHERE e.event_date = CURDATE() 
                   OR e.event_date = DATE_ADD(CURDATE(), INTERVAL 1 DAY);
            `;
            
            const [rows] = await pool.execute(query);

            for (const row of rows) {
                // Determine if the event is today or tomorrow to format the email text
                const eventDate = new Date(row.event_date);
                const today = new Date();
                const isToday = eventDate.toDateString() === today.toDateString();
                const timeFrame = isToday ? 'Today' : 'Tomorrow';

                const mailOptions = {
                    from: `"Schedule Manager" <${process.env.SMTP_USER}>`,
                    to: row.email,
                    subject: `Reminder: "${row.title}" is happening ${timeFrame}!`,
                    text: `Hello ${row.name},\n\nThis is a gentle reminder that you have an event scheduled for ${timeFrame}.\n\nEvent Details:\nTitle: ${row.title}\nDate: ${row.event_date}\nTime: ${row.start_time}\nVenue: ${row.venue}\n\nSee you there!`
                };

                // Send the email
                await transporter.sendMail(mailOptions);
                console.log(`Sent reminder to ${row.email} for event ${row.title}`);
            }

        } catch (error) {
            console.error('Error running daily reminder cron job:', error);
        }
    });
}

module.exports = { startCronJobs };