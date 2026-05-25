const pool = require('../db');
const { createGoogleEvent, deleteGoogleEvent, updateGoogleEvent } = require('../googleCalendar');
const { sendInviteEmail, sendCancellationEmail, sendRemovalEmail, sendMultiDayInviteEmail, sendDaySpecificInviteEmail } = require('../utils/mailer');

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
exports.getAdminTokens = getAdminTokens;

const cleanTime = (t) => {
    if (!t) return null;
    return t.split(':').length === 2 ? `${t}:00` : t;
};

exports.createEvent = async (req, res) => {
    let { 
        title = null, 
        description = null, 
        venue = null, 
        event_date = null, 
        end_date = null,
        start_time = null, 
        end_time = null, 
        attendees = [], 
        adminEmail = null, 
        category = 'General',
        event_span = 'single',
        days = [] 
    } = req.body;

    const tokens = await getAdminTokens(adminEmail);
    if (!tokens) return res.status(401).json({ error: 'No Google connection found. Please connect Google Calendar.' });

    let connection;
    try {
        connection = await pool.getConnection();
        await connection.beginTransaction();

        const createdEventIds = [];

        if (event_span === 'multiple' && Array.isArray(days) && days.length > 0) {
            // Generate a unique span_id for this multi-day event group
            const spanId = `span-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

            // Let's identify global attendees and normalize them
            const globalAttendees = Array.isArray(attendees) ? attendees : [];
            const globalEmails = new Set(globalAttendees.map(g => g.email.toLowerCase().trim()));

            for (const day of days) {
                const dayDate = day.date;
                const dayTitle = day.title || title;
                const dayDescription = day.description || description;
                const dayStart = cleanTime(day.start_time || start_time);
                const dayEnd = cleanTime(day.end_time || end_time);
                
                // Day-specific guests
                const daySpecificAttendees = Array.isArray(day.attendees) ? day.attendees.filter(g => g && g.email) : [];
                
                // Deduplicate combined invitees for GCal and Database event attendees
                const combinedMap = new Map();
                globalAttendees.forEach(g => combinedMap.set(g.email.toLowerCase().trim(), g));
                daySpecificAttendees.forEach(g => {
                    const email = g.email.toLowerCase().trim();
                    if (!combinedMap.has(email)) {
                        combinedMap.set(email, g);
                    }
                });
                const dayAllInvitees = Array.from(combinedMap.values());

                if (!dayDate || !dayStart || !dayEnd) {
                    throw new Error(`Missing date or time fields for one of the days`);
                }

                if (dayEnd <= dayStart) {
                    throw new Error(`End time must be strictly after start time on ${dayDate}`);
                }

                // Create individual day event row
                const [eventResult] = await connection.execute(
                    `INSERT INTO events (title, description, venue, event_date, end_date, start_time, end_time, category, span_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                    [dayTitle, dayDescription, venue, dayDate, dayDate, dayStart, dayEnd, category, spanId]
                );
                const newEventId = eventResult.insertId;
                createdEventIds.push(newEventId);

                // Attach Attendees to this individual day (both global and day-specific)
                for (const person of dayAllInvitees) {
                    const attendeeEmail = person.email.toLowerCase().trim();
                    await connection.execute(`INSERT IGNORE INTO Attendees (name, email) VALUES (?, ?)`, [person.name || 'Guest', attendeeEmail]);
                    const [rec] = await connection.execute(`SELECT attendee_id FROM Attendees WHERE email = ?`, [attendeeEmail]);
                    await connection.execute(`INSERT INTO Event_Attendees (event_id, attendee_id) VALUES (?, ?)`, [newEventId, rec[0].attendee_id]);
                }

                // Sync with Google Calendar for this specific day (inviting all dayAllInvitees)
                const googleStart = `${dayDate}T${dayStart}`;
                const googleEnd = `${dayDate}T${dayEnd}`;
                const googleEventId = await createGoogleEvent({ title: dayTitle, description: dayDescription, venue, startISO: googleStart, endISO: googleEnd }, dayAllInvitees, tokens);
                if (googleEventId) {
                    await connection.execute(`UPDATE events SET google_event_id = ? WHERE event_id = ?`, [googleEventId, newEventId]);
                }

                // Send day-specific invite emails to day-specific guests ONLY (those not in globalAttendees)
                for (const person of daySpecificAttendees) {
                    const email = person.email.toLowerCase().trim();
                    if (globalEmails.has(email)) continue; // skip if they are already in the global/all-days list

                    try {
                        await sendDaySpecificInviteEmail({
                            person,
                            globalTitle: title,
                            globalDescription: description,
                            dayTitle,
                            dayDescription,
                            venue,
                            event_date: dayDate,
                            mysqlStart: dayStart,
                            mysqlEnd: dayEnd,
                            newEventId
                        });
                    } catch (e) {
                        console.error(`❌ Failed to send day-specific invite to ${person.email} for ${dayDate}:`, e.message);
                    }
                }
            }

            // Send single multi-day invite email to each global attendee containing the full event schedule and multi-day ICS
            for (const person of globalAttendees) {
                try {
                    await sendMultiDayInviteEmail({
                        person,
                        title,
                        description,
                        venue,
                        days,
                        createdEventIds
                    });
                } catch (e) {
                    console.error(`❌ Failed to send multi-day invite to ${person.email}:`, e.message);
                }
            }

        } else {
            // Single Day Event Logic (original)
            const mysqlStart = cleanTime(start_time);
            const mysqlEnd = cleanTime(end_time);

            if (!event_date || !mysqlStart || !mysqlEnd) {
                return res.status(400).json({ error: 'Missing date or time fields' });
            }

            if (mysqlEnd <= mysqlStart) {
                return res.status(400).json({ error: 'End time must be strictly after start time' });
            }

            const [eventResult] = await connection.execute(
                `INSERT INTO events (title, description, venue, event_date, end_date, start_time, end_time, category) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
                [title, description, venue, event_date, event_date, mysqlStart, mysqlEnd, category]
            );
            const newEventId = eventResult.insertId;
            createdEventIds.push(newEventId);

            // Attach Attendees
            for (const person of attendees) {
                const attendeeEmail = person.email.toLowerCase().trim();
                await connection.execute(`INSERT IGNORE INTO Attendees (name, email) VALUES (?, ?)`, [person.name || 'Guest', attendeeEmail]);
                const [rec] = await connection.execute(`SELECT attendee_id FROM Attendees WHERE email = ?`, [attendeeEmail]);
                await connection.execute(`INSERT INTO Event_Attendees (event_id, attendee_id) VALUES (?, ?)`, [newEventId, rec[0].attendee_id]);
            }

            // Sync with Google Calendar
            const googleStart = `${event_date}T${mysqlStart}`;
            const googleEnd = `${event_date}T${mysqlEnd}`;
            const googleEventId = await createGoogleEvent({ title, description, venue, startISO: googleStart, endISO: googleEnd }, attendees, tokens);
            if (googleEventId) {
                await connection.execute(`UPDATE events SET google_event_id = ? WHERE event_id = ?`, [googleEventId, newEventId]);
            }

            // Send invite emails
            for (const person of attendees) {
                try {
                    await sendInviteEmail({ person, title: description, venue, event_date, mysqlStart, mysqlEnd, newEventId });
                } catch (e) {
                    console.error(`❌ Failed to send invite to ${person.email}:`, e.message);
                }
            }
        }

        await connection.commit();

        const allEmailsSet = new Set();
        if (event_span === 'multiple' && Array.isArray(days)) {
            if (Array.isArray(attendees)) attendees.forEach(a => allEmailsSet.add(a.email.toLowerCase().trim()));
            for (const day of days) {
                if (Array.isArray(day.attendees)) day.attendees.forEach(a => { if (a && a.email) allEmailsSet.add(a.email.toLowerCase().trim()); });
            }
        } else {
            if (Array.isArray(attendees)) attendees.forEach(a => allEmailsSet.add(a.email.toLowerCase().trim()));
        }

        const io = req.app.get('io');
        if (io) {
            io.emit('calendar_events_updated', {
                action: 'created',
                title: title,
                attendees: Array.from(allEmailsSet)
            });
        }

        res.status(201).json({ message: 'Success!', eventIds: createdEventIds });
    } catch (error) {
        if (connection) await connection.rollback();
        console.error('Event creation error:', error.message);
        res.status(500).json({ error: error.message });
    } finally {
        if (connection) connection.release();
    }
};

exports.getEvents = async (req, res) => {
    const role = req.query.role || 'admin';
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
            SELECT ea.event_id, a.name, a.email
            FROM Event_Attendees ea
            JOIN Attendees a ON ea.attendee_id = a.attendee_id
        `);

        // Pre-group attendees by event_id for O(1) lookup
        const attendeeMap = {};
        for (const a of attendees) {
            if (!attendeeMap[a.event_id]) attendeeMap[a.event_id] = [];
            attendeeMap[a.event_id].push(a);
        }

        const result = events.map(event => {
            const eventAttendees = attendeeMap[event.event_id] || [];
            return {
                ...event,
                attendees: role === 'admin'
                    ? eventAttendees.map(a => ({ name: a.name, email: a.email }))
                    : eventAttendees.filter(a => a.email === email).map(a => ({ name: a.name, email: a.email })),
            };
        });

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
            if (tokens) {
                const googleIds = event.google_event_id.split(',');
                for (const gid of googleIds) {
                    if (gid.trim()) await deleteGoogleEvent(gid.trim(), tokens);
                }
            }
        }

        await pool.execute(`DELETE FROM Events WHERE event_id = ?`, [eventId]);
        await pool.execute(`
            DELETE Attendees FROM Attendees
            LEFT JOIN Event_Attendees ON Attendees.attendee_id = Event_Attendees.attendee_id
            WHERE Event_Attendees.event_id IS NULL
        `);

        if (event.attendee_emails) {
            const names = event.attendee_names.split('||');
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

        const io = req.app.get('io');
        if (io) io.emit('calendar_events_updated');

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
                if (tokens) {
                    const googleIds = event.google_event_id.split(',');
                    for (const gid of googleIds) {
                        if (gid.trim()) await deleteGoogleEvent(gid.trim(), tokens);
                    }
                }
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

        const io = req.app.get('io');
        if (io) {
            io.emit('calendar_events_updated', {
                action: 'added_attendee',
                email: attendeeEmail,
                title: eventRows[0]?.title
            });
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

        const io = req.app.get('io');
        if (io) {
            io.emit('calendar_events_updated', {
                action: 'removed_attendee',
                email: decodedEmail
            });
        }

        res.json({ message: 'Attendee removed' });
    } catch (error) {
        console.error('Remove attendee error:', error);
        res.status(500).json({ error: 'Failed to remove attendee' });
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

        const io = req.app.get('io');
        if (io) io.emit('calendar_events_updated');

        res.status(200).json({ message: 'Event updated successfully!' });
    } catch (error) {
        console.error('Error updating event:', error);
        res.status(500).json({ error: 'Failed to update event' });
    }
};
