const pool = require('../db');
const { createGoogleEvent, deleteGoogleEvent, updateGoogleEvent } = require('../googleCalendar');
const { sendInviteEmail, sendCancellationEmail, sendRemovalEmail } = require('../utils/mailer');

const getAdminTokens = async (adminEmail) => {
    if (adminEmail) {
        const [rows] = await pool.execute(
            'SELECT google_tokens FROM users WHERE email = ? AND role = "admin" LIMIT 1',
            [adminEmail]
        );
        if (rows.length && rows[0].google_tokens) {
            return typeof rows[0].google_tokens === 'string'
                ? JSON.parse(rows[0].google_tokens)
                : rows[0].google_tokens;
        }
    }
    // Fallback to any admin with tokens
    const [fallback] = await pool.execute(
        'SELECT google_tokens FROM users WHERE role = "admin" AND google_tokens IS NOT NULL LIMIT 1'
    );
    if (!fallback.length || !fallback[0].google_tokens) return null;
    return typeof fallback[0].google_tokens === 'string'
        ? JSON.parse(fallback[0].google_tokens)
        : fallback[0].google_tokens;
};

const cleanTime = (t) => {
    if (!t) return null;
    return t.split(':').length === 2 ? `${t}:00` : t;
};

exports.createEvent = async (req, res) => {
    let { title = null, description = null, venue = null, event_date = null,
          start_time = null, end_time = null, attendees = [], adminEmail = null, category = 'General' } = req.body;

    const mysqlStart = cleanTime(start_time);
    const mysqlEnd   = cleanTime(end_time);
    const googleStart = (event_date && mysqlStart) ? `${event_date}T${mysqlStart}` : null;
    const googleEnd   = (event_date && mysqlEnd)   ? `${event_date}T${mysqlEnd}`   : null;

    if (!googleStart || !googleEnd) {
        return res.status(400).json({ error: 'Missing date or time fields' });
    }

    const tokens = await getAdminTokens(adminEmail);
    if (!tokens) return res.status(401).json({ error: 'No Google connection found. Please connect Google Calendar.' });

    let connection;
    try {
        connection = await pool.getConnection();
        await connection.beginTransaction();

        const [eventResult] = await connection.execute(
            `INSERT INTO events (title, description, venue, event_date, start_time, end_time, category) VALUES (?, ?, ?, ?, ?, ?, ?)`,
            [title, description, venue, event_date, mysqlStart, mysqlEnd, category]
        );
        const newEventId = eventResult.insertId;

        for (const person of attendees) {
            const attendeeEmail = person.email.toLowerCase().trim();
            await connection.execute(`INSERT IGNORE INTO Attendees (name, email) VALUES (?, ?)`, [person.name || 'Guest', attendeeEmail]);
            const [rec] = await connection.execute(`SELECT attendee_id FROM Attendees WHERE email = ?`, [attendeeEmail]);
            await connection.execute(`INSERT INTO Event_Attendees (event_id, attendee_id) VALUES (?, ?)`, [newEventId, rec[0].attendee_id]);
        }

        const googleEventId = await createGoogleEvent({ title, description, venue, startISO: googleStart, endISO: googleEnd }, attendees, tokens);
        await connection.execute(`UPDATE events SET google_event_id = ? WHERE event_id = ?`, [googleEventId, newEventId]);
        await connection.commit();

        // Send invite emails
        for (const person of attendees) {
            try {
                await sendInviteEmail({ person, title, description, venue, event_date, mysqlStart, mysqlEnd, newEventId });
                console.log(`✅ Invite sent to ${person.email}`);
            } catch (e) {
                console.error(`❌ Failed to send invite to ${person.email}:`, e.message);
            }
        }

        res.status(201).json({ message: 'Success!', eventId: newEventId, googleEventId });
    } catch (error) {
        if (connection) await connection.rollback();
        console.error('Event creation error:', error.message);
        res.status(500).json({ error: error.message });
    } finally {
        if (connection) connection.release();
    }
};

exports.getEvents = async (req, res) => {
    const role  = req.query.role  || 'admin';
    const email = req.query.email || null;

    try {
        let eventsQuery, params = [];
        if (role === 'admin' || !email) {
            eventsQuery = `SELECT * FROM Events ORDER BY event_date ASC, start_time ASC`;
        } else {
            eventsQuery = `
                SELECT e.* FROM Events e
                JOIN Event_Attendees ea ON e.event_id = ea.event_id
                JOIN Attendees a ON ea.attendee_id = a.attendee_id
                WHERE a.email = ?
                ORDER BY e.event_date ASC, e.start_time ASC`;
            params = [email];
        }

        const [events] = await pool.execute(eventsQuery, params);
        const [attendees] = await pool.execute(`
            SELECT ea.event_id, a.name, a.email, ea.rsvp_status
            FROM Event_Attendees ea
            JOIN Attendees a ON ea.attendee_id = a.attendee_id
        `);

        const result = events.map(event => ({
            ...event,
            attendees: role === 'admin'
                ? attendees.filter(a => a.event_id === event.event_id).map(a => ({ name: a.name, email: a.email, rsvp_status: a.rsvp_status }))
                : attendees.filter(a => a.event_id === event.event_id && a.email === email).map(a => ({ rsvp_status: a.rsvp_status })),
        }));

        res.status(200).json(result);
    } catch (error) {
        console.error('Error fetching events:', error);
        res.status(500).json({ error: 'Failed to fetch events' });
    }
};

exports.deleteEvent = async (req, res) => {
    const eventId = req.params.id;
    try {
        const [eventRows] = await pool.execute(
            `SELECT e.*, GROUP_CONCAT(a.name SEPARATOR '||') AS attendee_names,
                    GROUP_CONCAT(a.email SEPARATOR '||') AS attendee_emails
             FROM Events e
             LEFT JOIN Event_Attendees ea ON e.event_id = ea.event_id
             LEFT JOIN Attendees a ON ea.attendee_id = a.attendee_id
             WHERE e.event_id = ? GROUP BY e.event_id`,
            [eventId]
        );

        if (!eventRows.length) return res.status(404).json({ error: 'Event not found' });

        const event = eventRows[0];

        if (event.google_event_id) {
            const tokens = await getAdminTokens(null);
            if (tokens) await deleteGoogleEvent(event.google_event_id, tokens);
        }

        await pool.execute(`DELETE FROM Events WHERE event_id = ?`, [eventId]);
        await pool.execute(`
            DELETE Attendees FROM Attendees
            LEFT JOIN Event_Attendees ON Attendees.attendee_id = Event_Attendees.attendee_id
            WHERE Event_Attendees.event_id IS NULL
        `);

        if (event.attendee_emails) {
            const names  = event.attendee_names.split('||');
            const emails = event.attendee_emails.split('||');
            for (let i = 0; i < emails.length; i++) {
                try {
                    await sendCancellationEmail({ name: names[i], email: emails[i], event });
                    console.log(`✅ Cancellation sent to ${emails[i]}`);
                } catch (e) {
                    console.error(`❌ Failed to send cancellation to ${emails[i]}:`, e.message);
                }
            }
        }

        res.status(200).json({ message: 'Event deleted successfully!' });
    } catch (error) {
        console.error('Error deleting event:', error);
        res.status(500).json({ error: 'Failed to delete event' });
    }
};

exports.deleteAllEvents = async (req, res) => {
    try {
        const [events] = await pool.execute(`SELECT google_event_id FROM Events WHERE google_event_id IS NOT NULL`);
        if (!events.length) return res.status(200).json({ message: 'No events to delete.' });

        const tokens = await getAdminTokens(null);
        for (const event of events) {
            try {
                if (tokens) await deleteGoogleEvent(event.google_event_id, tokens);
            } catch (e) {
                console.warn(`Could not delete Google event ${event.google_event_id}`);
            }
        }

        await pool.execute(`DELETE FROM Events`);
        await pool.execute(`ALTER TABLE Events AUTO_INCREMENT = 1`);
        res.status(200).json({ message: `Deleted ${events.length} events.` });
    } catch (error) {
        console.error('Bulk delete error:', error);
        res.status(500).json({ error: 'Failed to delete all events' });
    }
};

exports.addAttendee = async (req, res) => {
    const eventId = req.params.id;
    const { name, email } = req.body;
    if (!name || !email) return res.status(400).json({ error: 'Name and email required' });
    let connection;
    try {
        connection = await pool.getConnection();
        await connection.beginTransaction();
        const attendeeEmail = email.toLowerCase().trim();
        await connection.execute(`INSERT IGNORE INTO Attendees (name, email) VALUES (?, ?)`, [name, attendeeEmail]);
        const [rec] = await connection.execute(`SELECT attendee_id FROM Attendees WHERE email = ?`, [attendeeEmail]);
        const [existing] = await connection.execute(`SELECT 1 FROM Event_Attendees WHERE event_id = ? AND attendee_id = ?`, [eventId, rec[0].attendee_id]);
        if (existing.length) {
            await connection.rollback();
            return res.status(409).json({ error: 'Attendee already added to this event' });
        }
        await connection.execute(`INSERT INTO Event_Attendees (event_id, attendee_id) VALUES (?, ?)`, [eventId, rec[0].attendee_id]);
        
        const [eventRows] = await connection.execute(`SELECT * FROM Events WHERE event_id = ?`, [eventId]);
        await connection.commit();

        if (eventRows.length > 0) {
            const event = eventRows[0];
            try {
                // Handle Date object formatting if necessary
                const event_date = event.event_date instanceof Date ? event.event_date.toISOString().split('T')[0] : event.event_date;
                await sendInviteEmail({
                    person: { name, email: attendeeEmail },
                    title: event.title,
                    description: event.description,
                    venue: event.venue,
                    event_date: event_date,
                    mysqlStart: event.start_time,
                    mysqlEnd: event.end_time,
                    newEventId: eventId
                });
                console.log(`✅ Invite sent to ${attendeeEmail}`);
            } catch (e) {
                console.error(`❌ Failed to send invite to ${attendeeEmail}:`, e.message);
            }
        }

        res.status(201).json({ message: 'Attendee added and invited' });
    } catch (error) {
        if (connection) await connection.rollback();
        console.error('Add attendee error:', error);
        res.status(500).json({ error: 'Failed to add attendee' });
    } finally {
        if (connection) connection.release();
    }
};

exports.removeAttendee = async (req, res) => {
    const { id: eventId, email } = req.params;
    const decodedEmail = decodeURIComponent(email);
    try {
        const [rec] = await pool.execute(`SELECT attendee_id, name FROM Attendees WHERE email = ?`, [decodedEmail]);
        if (!rec.length) return res.status(404).json({ error: 'Attendee not found' });
        await pool.execute(`DELETE FROM Event_Attendees WHERE event_id = ? AND attendee_id = ?`, [eventId, rec[0].attendee_id]);

        const [eventRows] = await pool.execute(`SELECT * FROM Events WHERE event_id = ?`, [eventId]);
        if (eventRows.length) {
            try {
                const event = eventRows[0];
                const event_date = event.event_date instanceof Date ? event.event_date.toISOString().split('T')[0] : event.event_date;
                await sendRemovalEmail({ name: rec[0].name, email: decodedEmail, event: { ...event, event_date } });
                console.log(`✅ Removal notice sent to ${decodedEmail}`);
            } catch (e) {
                console.error(`❌ Failed to send removal email to ${decodedEmail}:`, e.message);
            }
        }

        res.json({ message: 'Attendee removed' });
    } catch (error) {
        console.error('Remove attendee error:', error);
        res.status(500).json({ error: 'Failed to remove attendee' });
    }
};

exports.rsvpEvent = async (req, res) => {
    const eventId = req.params.id;
    // Support both GET (email link) and PATCH (dashboard button)
    const email = req.body?.email || req.query?.email;
    const status = req.body?.status || req.query?.status;
    const isEmailLink = req.method === 'GET';

    if (!email || !['accepted', 'declined'].includes(status))
        return isEmailLink
            ? res.status(400).send('<h2>Invalid RSVP link.</h2>')
            : res.status(400).json({ error: 'Valid email and status (accepted/declined) required' });
    try {
        // Block re-voting if already responded
        const [existing] = await pool.execute(
            `SELECT ea.rsvp_status FROM Event_Attendees ea
             JOIN Attendees a ON ea.attendee_id = a.attendee_id
             WHERE ea.event_id = ? AND a.email = ?`,
            [eventId, email.toLowerCase()]
        );
        if (existing.length && existing[0].rsvp_status !== 'pending') {
            const already = existing[0].rsvp_status;
            if (isEmailLink) {
                const color = already === 'accepted' ? '#16a34a' : '#dc2626';
                const emoji = already === 'accepted' ? '✅' : '❌';
                return res.send(`
                    <!DOCTYPE html><html><body style="font-family:'Segoe UI',sans-serif;display:flex;align-items:center;justify-content:center;min-height:100vh;background:#f1f5f9;margin:0;">
                    <div style="background:white;padding:48px;border-radius:16px;text-align:center;box-shadow:0 4px 24px rgba(0,0,0,0.08);max-width:400px;">
                        <div style="font-size:48px;margin-bottom:16px;">${emoji}</div>
                        <h2 style="color:${color};margin:0 0 8px;">Already ${already.charAt(0).toUpperCase() + already.slice(1)}</h2>
                        <p style="color:#64748b;margin:0;">You have already responded to this event. Your response cannot be changed.</p>
                    </div></body></html>
                `);
            }
            return res.status(409).json({ error: `Already ${already}. RSVP cannot be changed.` });
        }
        const [result] = await pool.execute(
            `UPDATE Event_Attendees ea
             JOIN Attendees a ON ea.attendee_id = a.attendee_id
             SET ea.rsvp_status = ?
             WHERE ea.event_id = ? AND a.email = ?`,
            [status, eventId, email.toLowerCase()]
        );
        if (result.affectedRows === 0)
            return isEmailLink
                ? res.status(404).send('<h2>You are not registered for this event.</h2>')
                : res.status(404).json({ error: 'Attendee not found for this event' });

        if (isEmailLink) {
            const color = status === 'accepted' ? '#16a34a' : '#dc2626';
            const emoji = status === 'accepted' ? '✅' : '❌';
            return res.send(`
                <!DOCTYPE html><html><body style="font-family:'Segoe UI',sans-serif;display:flex;align-items:center;justify-content:center;min-height:100vh;background:#f1f5f9;margin:0;">
                <div style="background:white;padding:48px;border-radius:16px;text-align:center;box-shadow:0 4px 24px rgba(0,0,0,0.08);max-width:400px;">
                    <div style="font-size:48px;margin-bottom:16px;">${emoji}</div>
                    <h2 style="color:${color};margin:0 0 8px;">RSVP ${status.charAt(0).toUpperCase() + status.slice(1)}!</h2>
                    <p style="color:#64748b;margin:0;">Your response has been recorded. You can close this tab.</p>
                </div></body></html>
            `);
        }
        res.json({ message: `RSVP updated to ${status}` });
    } catch (error) {
        console.error('RSVP error:', error);
        isEmailLink
            ? res.status(500).send('<h2>Something went wrong. Please try again.</h2>')
            : res.status(500).json({ error: 'Failed to update RSVP' });
    }
};

exports.updateEvent = async (req, res) => {
    const eventId = req.params.id;
    const updates = req.body;
    if (!Object.keys(updates).length) return res.status(400).json({ error: 'No data provided' });

    try {
        const [eventRows] = await pool.execute(`SELECT * FROM Events WHERE event_id = ?`, [eventId]);
        if (!eventRows.length) return res.status(404).json({ error: 'Event not found' });

        const fields = [], values = [];
        for (const [key, value] of Object.entries(updates)) {
            if (['title', 'description', 'venue', 'event_date', 'start_time', 'end_time', 'category'].includes(key)) {
                fields.push(`${key} = ?`);
                values.push(value);
            }
        }
        if (fields.length) {
            values.push(eventId);
            await pool.execute(`UPDATE Events SET ${fields.join(', ')} WHERE event_id = ?`, values);
        }

        if (eventRows[0].google_event_id) {
            await updateGoogleEvent(eventRows[0].google_event_id, { ...eventRows[0], ...updates });
        }

        res.status(200).json({ message: 'Event updated successfully!' });
    } catch (error) {
        console.error('Error updating event:', error);
        res.status(500).json({ error: 'Failed to update event' });
    }
};
