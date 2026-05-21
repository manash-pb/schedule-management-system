// cronJobs.js
const cron = require('node-cron');
const pool = require('./db');
const { transporter, sendInviteEmail } = require('./utils/mailer');
const { createGoogleEvent } = require('./googleCalendar');
const { getAdminTokens } = require('./controllers/eventController');

const formatTime12 = (t) => {
    if (!t) return '';
    const [h, m] = t.split(':').map(Number);
    const ampm = h >= 12 ? 'PM' : 'AM';
    return `${String(h % 12 || 12).padStart(2, '0')}:${String(m).padStart(2, '0')} ${ampm}`;
};

function startCronJobs() {
    // Daily reminder: today & tomorrow events at 1:00 AM
    cron.schedule('0 1 * * *', async () => {
        console.log('Running daily email reminder job...');
        try {
            const [rows] = await pool.execute(`
                SELECT e.title, e.event_date, e.start_time, e.end_time, e.venue, a.email, a.name
                FROM Events e
                JOIN Event_Attendees ea ON e.event_id = ea.event_id
                JOIN Attendees a ON ea.attendee_id = a.attendee_id
                WHERE e.event_date = CURDATE()
                   OR e.event_date = DATE_ADD(CURDATE(), INTERVAL 1 DAY)
            `);
            for (const row of rows) {
                const isToday = new Date(row.event_date).toDateString() === new Date().toDateString();
                const timeFrame = isToday ? 'Today' : 'Tomorrow';
                const formattedDate = new Date(row.event_date).toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
                const html = `
<!DOCTYPE html><html><body style="margin:0;padding:0;background:#f1f5f9;font-family:'Segoe UI',Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f1f5f9;padding:40px 0;">
    <tr><td align="center">
      <table width="560" cellpadding="0" cellspacing="0" style="background:#fff;border-radius:16px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,0.08);">
        <tr><td style="background:linear-gradient(135deg,#f59e0b,#d97706);padding:32px 36px;">
          <p style="margin:0 0 4px 0;font-size:13px;color:#fef3c7;letter-spacing:0.08em;text-transform:uppercase;">Event Reminder</p>
          <h1 style="margin:0;font-size:24px;color:#fff;font-weight:700;">${row.title}</h1>
        </td></tr>
        <tr><td style="padding:32px 36px;">
          <p style="margin:0 0 6px 0;font-size:15px;color:#0f172a;">Hi <strong>${row.name}</strong>,</p>
          <p style="margin:0 0 24px 0;font-size:14px;color:#64748b;">This is a reminder that you have an event <strong>${timeFrame}</strong>.</p>
          <table width="100%" cellpadding="0" cellspacing="0" style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:12px;padding:20px 24px;">
            <tr><td style="padding:8px 0;color:#64748b;font-size:14px;width:110px;">📅 <strong>Date</strong></td><td style="padding:8px 0;font-size:14px;color:#0f172a;">${formattedDate}</td></tr>
            <tr><td style="padding:8px 0;color:#64748b;font-size:14px;">🕐 <strong>Time</strong></td><td style="padding:8px 0;font-size:14px;color:#0f172a;">${formatTime12(row.start_time)} – ${formatTime12(row.end_time)}</td></tr>
            <tr><td style="padding:8px 0;color:#64748b;font-size:14px;">📍 <strong>Venue</strong></td><td style="padding:8px 0;font-size:14px;color:#0f172a;">${row.venue}</td></tr>
          </table>
        </td></tr>
        <tr><td style="background:#f8fafc;border-top:1px solid #e2e8f0;padding:20px 36px;text-align:center;">
          <p style="margin:0;font-size:12px;color:#94a3b8;">Sent by <strong>Schedule Manager</strong>. Do not reply.</p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body></html>`;
                await transporter.sendMail({
                    from: `"Schedule Manager" <${process.env.SMTP_USER}>`,
                    to: row.email,
                    subject: `Reminder: "${row.title}" is ${timeFrame}!`,
                    html,
                });
                console.log(`Sent daily reminder to ${row.email} for "${row.title}"`);
            }
        } catch (error) {
            console.error('Daily reminder cron error:', error);
        }
    });

    // 1-hour reminder: runs every minute, finds events starting in ~60 minutes
    cron.schedule('* * * * *', async () => {
        try {
            const [rows] = await pool.execute(`
                SELECT e.event_id, e.title, e.event_date, e.start_time, e.end_time, e.venue, a.email, a.name
                FROM Events e
                JOIN Event_Attendees ea ON e.event_id = ea.event_id
                JOIN Attendees a ON ea.attendee_id = a.attendee_id
                WHERE e.event_date = CURDATE()
                  AND TIMESTAMPDIFF(MINUTE, NOW(), CONCAT(e.event_date, ' ', e.start_time)) BETWEEN 59 AND 61
            `);
            for (const row of rows) {
                const formattedDate = new Date(row.event_date).toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
                const html = `
<!DOCTYPE html><html><body style="margin:0;padding:0;background:#f1f5f9;font-family:'Segoe UI',Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f1f5f9;padding:40px 0;">
    <tr><td align="center">
      <table width="560" cellpadding="0" cellspacing="0" style="background:#fff;border-radius:16px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,0.08);">
        <tr><td style="background:linear-gradient(135deg,#2563eb,#1d4ed8);padding:32px 36px;">
          <p style="margin:0 0 4px 0;font-size:13px;color:#bfdbfe;letter-spacing:0.08em;text-transform:uppercase;">Starting in 1 Hour</p>
          <h1 style="margin:0;font-size:24px;color:#fff;font-weight:700;">${row.title}</h1>
        </td></tr>
        <tr><td style="padding:32px 36px;">
          <p style="margin:0 0 6px 0;font-size:15px;color:#0f172a;">Hi <strong>${row.name}</strong>,</p>
          <p style="margin:0 0 24px 0;font-size:14px;color:#64748b;">Your event starts in <strong>1 hour</strong>. Get ready!</p>
          <table width="100%" cellpadding="0" cellspacing="0" style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:12px;padding:20px 24px;">
            <tr><td style="padding:8px 0;color:#64748b;font-size:14px;width:110px;">📅 <strong>Date</strong></td><td style="padding:8px 0;font-size:14px;color:#0f172a;">${formattedDate}</td></tr>
            <tr><td style="padding:8px 0;color:#64748b;font-size:14px;">🕐 <strong>Time</strong></td><td style="padding:8px 0;font-size:14px;color:#0f172a;">${formatTime12(row.start_time)} – ${formatTime12(row.end_time)}</td></tr>
            <tr><td style="padding:8px 0;color:#64748b;font-size:14px;">📍 <strong>Venue</strong></td><td style="padding:8px 0;font-size:14px;color:#0f172a;">${row.venue}</td></tr>
          </table>
        </td></tr>
        <tr><td style="background:#f8fafc;border-top:1px solid #e2e8f0;padding:20px 36px;text-align:center;">
          <p style="margin:0;font-size:12px;color:#94a3b8;">Sent by <strong>Schedule Manager</strong>. Do not reply.</p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body></html>`;
                await transporter.sendMail({
                    from: `"Schedule Manager" <${process.env.SMTP_USER}>`,
                    to: row.email,
                    subject: `⏰ Starting in 1 hour: "${row.title}"`,
                    html,
                });
                console.log(`Sent 1-hour reminder to ${row.email} for "${row.title}"`);
            }
        } catch (error) {
            console.error('1-hour reminder cron error:', error);
        }
    });

    // Recurring events: check every 5 minutes
    cron.schedule('*/5 * * * *', async () => {
        console.log('Running recurring events generator job...');
        try {
            // Find completed events that need next recurrence
            // Completed means date + end_time is in the past
            const [rows] = await pool.execute(`
                SELECT * FROM Events 
                WHERE recurrence_type IS NOT NULL 
                  AND recurrence_type != 'Does not repeat' 
                  AND next_occurrence_generated = 0
                  AND TIMESTAMP(event_date, end_time) < NOW()
            `);

            for (const event of rows) {
                console.log(`Generating next occurrence for event ID ${event.event_id} (${event.title})`);
                
                // Calculate next date
                const nextDateObj = new Date(event.event_date);
                if (event.recurrence_type === 'Daily') nextDateObj.setDate(nextDateObj.getDate() + 1);
                else if (event.recurrence_type === 'Weekly') nextDateObj.setDate(nextDateObj.getDate() + 7);
                else if (event.recurrence_type === 'Monthly') nextDateObj.setMonth(nextDateObj.getMonth() + 1);

                const nextDateStr = nextDateObj.toISOString().split('T')[0];
                const mysqlStart = event.start_time;
                const mysqlEnd = event.end_time;
                const nextGoogleStart = `${nextDateStr}T${mysqlStart}`;
                const nextGoogleEnd = `${nextDateStr}T${mysqlEnd}`;

                const parentId = event.parent_event_id || event.event_id;

                let connection;
                try {
                    connection = await pool.getConnection();
                    await connection.beginTransaction();

                    // Insert next event
                    const [nextEventResult] = await connection.execute(
                        `INSERT INTO events (title, description, venue, event_date, start_time, end_time, category, recurrence_type, parent_event_id, admin_email) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                        [event.title, event.description, event.venue, nextDateStr, mysqlStart, mysqlEnd, event.category, event.recurrence_type, parentId, event.admin_email]
                    );
                    const nextEventId = nextEventResult.insertId;

                    // Get attendees from original event
                    const [attendees] = await connection.execute(
                        `SELECT a.attendee_id, a.name, a.email FROM Attendees a JOIN Event_Attendees ea ON a.attendee_id = ea.attendee_id WHERE ea.event_id = ?`,
                        [event.event_id]
                    );

                    for (const person of attendees) {
                        await connection.execute(`INSERT IGNORE INTO Event_Attendees (event_id, attendee_id) VALUES (?, ?)`, [nextEventId, person.attendee_id]);
                    }

                    // Sync with Google Calendar
                    let nextGoogleEventId = null;
                    const tokens = await getAdminTokens(event.admin_email);
                    if (tokens) {
                        try {
                            nextGoogleEventId = await createGoogleEvent({ title: event.title, description: event.description, venue: event.venue, startISO: nextGoogleStart, endISO: nextGoogleEnd }, attendees, tokens);
                            await connection.execute(`UPDATE events SET google_event_id = ? WHERE event_id = ?`, [nextGoogleEventId, nextEventId]);
                        } catch (e) {
                            console.error('Failed to create Google event for recurrence:', e.message);
                        }
                    }

                    // Send invite emails
                    for (const person of attendees) {
                        try {
                            await sendInviteEmail({ person, title: event.title, description: event.description, venue: event.venue, event_date: nextDateStr, mysqlStart, mysqlEnd, newEventId: nextEventId });
                        } catch (e) {
                            console.error(`Failed to send invite to ${person.email} for recurring instance:`, e.message);
                        }
                    }

                    // Mark current event as handled
                    await connection.execute(`UPDATE events SET next_occurrence_generated = 1 WHERE event_id = ?`, [event.event_id]);
                    
                    await connection.commit();
                    console.log(`✅ Successfully generated and scheduled next occurrence: ${nextDateStr}`);
                } catch (e) {
                    if (connection) await connection.rollback();
                    console.error(`Failed to generate recurrence for event ${event.event_id}:`, e);
                } finally {
                    if (connection) connection.release();
                }
            }
        } catch (error) {
            console.error('Recurring events cron error:', error);
        }
    });
}

module.exports = { startCronJobs };