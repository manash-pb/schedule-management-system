// server.js (Updated)
const { oauth2Client, getAuthUrl, createGoogleEvent, updateGoogleEvent, deleteGoogleEvent } = require('./googleCalendar');
const express = require('express');
const cors = require('cors');
const pool = require('./db');
const { startCronJobs } = require('./cronJobs'); // Import Cron Job logic
const { google } = require('googleapis');

require('dotenv').config();
const mysql = require('mysql2/promise');

// Quick test to make sure the connection works
pool.getConnection()
    .then(conn => {
        console.log('✅ Connected to MySQL Database!');
        conn.release();
    })
    .catch(err => console.error('❌ Database connection error:', err));

let currentUserTokens = null; // This will hold the "fuel" for the Google Calendar car
const app = express();
app.use(cors());
app.use(express.json());

// Start the background cron jobs
startCronJobs();

app.post('/api/events', async (req, res) => {
    let { 
        title = null, 
        description = null, 
        venue = null, 
        event_date = null, 
        start_time = null, 
        end_time = null, 
        attendees = [] 
    } = req.body;

    console.log("DEBUG - Received from Frontend:", req.body);

    // Helper to force HH:mm:ss
    const cleanTime = (t) => {
        if (!t) return null;
        const parts = t.split(':');
        if (parts.length === 2) return `${t}:00`; 
        return t;
    };

    const mysqlStart = cleanTime(start_time);
    const mysqlEnd = cleanTime(end_time);

    // Build ISO strings
    const googleStart = (event_date && mysqlStart) ? `${event_date}T${mysqlStart}` : null;
    const googleEnd = (event_date && mysqlEnd) ? `${event_date}T${mysqlEnd}` : null;

    // Detailed error logging
    if (!googleStart || !googleEnd) {
        console.error("❌ VALIDATION FAILED:", { 
            date: event_date, 
            start: mysqlStart, 
            end: mysqlEnd 
        });
        return res.status(400).json({ 
            error: `Missing fields: ${!event_date ? 'Date ' : ''}${!mysqlStart ? 'Start Time ' : ''}${!mysqlEnd ? 'End Time' : ''}` 
        });
    }

    let connection;

    try {
        connection = await pool.getConnection();
        
        const [userRows] = await connection.execute(
            'SELECT google_tokens FROM users WHERE role = "admin" LIMIT 1'
        );

        if (userRows.length === 0 || !userRows[0].google_tokens) {
            return res.status(401).json({ error: 'No Google connection found. Please sign in.' });
        }

        const storedTokens = typeof userRows[0].google_tokens === 'string' 
            ? JSON.parse(userRows[0].google_tokens) 
            : userRows[0].google_tokens;

        await connection.beginTransaction();

        // Use mysqlStart/mysqlEnd for the database insert
        const [eventResult] = await connection.execute(
            `INSERT INTO events (title, description, venue, event_date, start_time, end_time) VALUES (?, ?, ?, ?, ?, ?)`,
            [title, description, venue, event_date, mysqlStart, mysqlEnd]
        );
        const newEventId = eventResult.insertId;

        // --- ATTENDEE LOOP (Keep your existing loop here) ---
        if (attendees && attendees.length > 0) {
            for (let person of attendees) {
                const attendeeName = person.name || 'Guest'; 
                await connection.execute(`INSERT IGNORE INTO Attendees (name, email) VALUES (?, ?)`, [attendeeName, person.email]);
                const [attendeeRecord] = await connection.execute(`SELECT attendee_id FROM Attendees WHERE email = ?`, [person.email]);
                const attendeeId = attendeeRecord[0].attendee_id;
                await connection.execute(`INSERT INTO Event_Attendees (event_id, attendee_id) VALUES (?, ?)`, [newEventId, attendeeId]);
            }
        }

        // 3. Sync to Google Calendar using the CLEAN ISO strings
        const eventData = { 
            title, 
            description, 
            venue, 
            startISO: googleStart, 
            endISO: googleEnd 
        };
        
        const googleEventId = await createGoogleEvent(eventData, attendees, storedTokens);

        await connection.execute(
            `UPDATE events SET google_event_id = ? WHERE event_id = ?`,
            [googleEventId, newEventId]
        );

        await connection.commit(); 
        res.status(201).json({ message: 'Success!', eventId: newEventId, googleEventId });

    } catch (error) {
        if (connection) await connection.rollback();
        console.error('DATABASE CRASH DETAILS:', error.message);
        res.status(500).json({ error: error.message });
    } finally {
        if (connection) connection.release();
    }
});

// --- UPDATED GOOGLE CALLBACK LOGIC ---
app.get('/auth/google/callback', async (req, res) => {
    try {
        const { tokens } = await oauth2Client.getToken(req.query.code);
        // Grab the role we passed in the previous step
        const intendedRole = req.query.state || 'user';

        oauth2Client.setCredentials(tokens);

        const oauth2 = google.oauth2({ version: 'v2', auth: oauth2Client });
        const userInfo = await oauth2.userinfo.get();

        const googleId = userInfo.data.id;
        const email = userInfo.data.email.toLowerCase();
        const name = userInfo.data.name;

        // Check if the user exists
        const [rows] = await pool.execute('SELECT * FROM users WHERE email = ?', [email]);
        let user = rows[0];

        // If the DB says they are an Admin but they used the User login link:
        // - If they already have tokens (calendar access), just log them in as admin
        // - If they don't have tokens yet, bounce through Google once more with admin scopes
        if (user && user.role === 'admin' && intendedRole !== 'admin') {
            if (user.google_tokens) {
                console.log(`✅ Admin ${email} used User login but already has tokens. Logging in as admin.`);
                const name = userInfo.data.name;
                return res.redirect(`http://localhost:5173/?login=success&role=admin&email=${encodeURIComponent(email)}&name=${encodeURIComponent(name)}`);
            } else {
                console.log(`⚠️ Admin ${email} has no tokens. Re-requesting with admin scopes.`);
                return res.redirect('/auth/google?role=admin');
            }
        }
        
        if (user) {
            // Only update tokens for admins, and only when Google sends a fresh refresh_token
            if (user.role === 'admin' && tokens.refresh_token) {
                await pool.execute(
                    'UPDATE users SET google_id = ?, google_tokens = ? WHERE email = ?',
                    [googleId, JSON.stringify(tokens), email]
                );
                console.log(`✅ Updated admin tokens for: ${email}`);
            } else {
                // For regular users, just link the Google ID if not already set
                await pool.execute(
                    'UPDATE users SET google_id = ? WHERE email = ? AND google_id IS NULL',
                    [googleId, email]
                );
            }
        } else {
            // Create new user with tokens
            await pool.execute(
                'INSERT INTO users (name, email, google_id, google_tokens, role) VALUES (?, ?, ?, ?, ?)', 
                [name, email, googleId, tokenString, intendedRole]
            );
            console.log(`✅ Created user and saved tokens: ${email}`);
            
            const [newRows] = await pool.execute('SELECT role FROM users WHERE email = ?', [email]);
            user = newRows[0];
        }

        // Redirect with role
        const finalRole = user ? user.role : intendedRole;

        // Pass the extra data in the URL query string
        res.redirect(`http://localhost:5173/?login=success&role=${finalRole}&email=${encodeURIComponent(email)}&name=${encodeURIComponent(name)}`);

    } catch (error) {
        console.error('Error during Google authentication:', error);
        res.status(500).send('Authentication failed');
    }
});

// --- THE MISSING "ENTRY" ROUTE ---
app.get('/auth/google', (req, res) => {
    const requestedRole = req.query.role || 'user'; // Defaults to user

    // 1. Base scopes that EVERYONE needs (No Google verification required)
    const scopes = [
        'https://www.googleapis.com/auth/userinfo.profile',
        'https://www.googleapis.com/auth/userinfo.email'
    ];

    // 2. Only add the Sensitive Calendar scope if an ADMIN is logging in
    if (requestedRole === 'admin') {
        scopes.push('https://www.googleapis.com/auth/calendar');
    }

    // 3. Generate the URL that sends the user to Google
    const url = oauth2Client.generateAuthUrl({
        access_type: 'offline', 
        scope: scopes,
        prompt: 'consent', 
        // Pass the role through the 'state' variable so we remember it after Google redirects back
        state: requestedRole 
    });

    // 3. Redirect the browser to Google
    res.redirect(url);
});

// --- ROUTE: Get All Events with Attendees ---
app.get('/api/events', async (req, res) => {
    const role = req.query.role || 'admin';
    const email = req.query.email || null;

    try {
        let eventsQuery;
        let params = [];

        if (role === 'admin' || !email) {
            eventsQuery = `SELECT * FROM Events ORDER BY event_date ASC, start_time ASC`;
        } else {
            // Users only see events where they are listed as an attendee
            eventsQuery = `
                SELECT e.* FROM Events e
                JOIN Event_Attendees ea ON e.event_id = ea.event_id
                JOIN Attendees a ON ea.attendee_id = a.attendee_id
                WHERE a.email = ?
                ORDER BY e.event_date ASC, e.start_time ASC`;
            params = [email];
        }

        const [events] = await pool.execute(eventsQuery, params);

        // 2. Fetch attendees associated with the retrieved events
        // This ensures we only get attendee data for events the user is allowed to see
        const [attendees] = await pool.execute(`
            SELECT ea.event_id, a.name, a.email 
            FROM Event_Attendees ea
            JOIN Attendees a ON ea.attendee_id = a.attendee_id
        `);

        // 3. Attach attendees to their respective events
        const eventsWithAttendees = events.map(event => {
            const eventAttendees = attendees
                .filter(a => a.event_id === event.event_id)
                .map(a => ({ name: a.name, email: a.email }));

            return {
                ...event,
                attendees: role === 'admin' ? eventAttendees : []
            };
        });

        res.status(200).json(eventsWithAttendees);

    } catch (error) {
        console.error('Error fetching filtered events:', error);
        res.status(500).json({ error: 'Failed to fetch events' });
    }
});

// --- ROUTE: DELETE ALL Events ---
app.delete('/api/events', async (req, res) => {
    try {
        // 1. Fetch all events that have a Google Event ID
        const [events] = await pool.execute(`SELECT google_event_id FROM Events WHERE google_event_id IS NOT NULL`);

        // If there are no events, just return a success message early
        if (events.length === 0) {
            return res.status(200).json({ message: 'No events found to delete.' });
        }

        console.log(`Attempting to delete ${events.length} events from Google Calendar...`);

        // 2. Loop through and delete them from Google Calendar one by one
        for (let event of events) {
            try {
                await deleteGoogleEvent(event.google_event_id);
            } catch (gcalError) {
                // If one fails (e.g., already deleted manually on Google), we log it but KEEP GOING
                console.warn(`Could not delete Google event ${event.google_event_id}. Moving to next...`);
            }
        }

        // 3. Now that Google is clean, wipe the MySQL Events table
        await pool.execute(`DELETE FROM Events`);
        
        // Optional: Reset the ID counter back to 1 so your next event is ID #1
        await pool.execute(`ALTER TABLE Events AUTO_INCREMENT = 1`);

        res.status(200).json({ 
            message: `Successfully deleted ${events.length} events from the database and Google Calendar!` 
        });

    } catch (error) {
        console.error('Error in bulk delete:', error);
        res.status(500).json({ error: 'Failed to delete all events' });
    }
});

app.delete('/api/events/:id', async (req, res) => {
    const eventId = req.params.id; // Grabs the ID from the URL

    try {
        // 1. Fetch the google_event_id from the database first
        const [eventRows] = await pool.execute(`SELECT google_event_id FROM Events WHERE event_id = ?`, [eventId]);
        
        if (eventRows.length === 0) {
            return res.status(404).json({ error: 'Event not found' });
        }

        const googleEventId = eventRows[0].google_event_id;

        // 2. Delete from Google Calendar
        if (googleEventId) {
            await deleteGoogleEvent(googleEventId);
        }

        // 3. Delete from MySQL 
        // (Attendees link in the junction table will auto-delete due to ON DELETE CASCADE)
        await pool.execute(`DELETE FROM Events WHERE event_id = ?`, [eventId]);

        // 4. Clean up Orphaned Attendees
        // (Finds any attendees that no longer have a matching row in the junction table)
        const deleteOrphansQuery = `
            DELETE Attendees 
            FROM Attendees 
            LEFT JOIN Event_Attendees ON Attendees.attendee_id = Event_Attendees.attendee_id 
            WHERE Event_Attendees.event_id IS NULL;
        `;
        
        // Note: Please double-check that 'Attendees' and 'Event_Attendees' match your actual table names
        const [orphanResult] = await pool.execute(deleteOrphansQuery);
        console.log(`Cleaned up ${orphanResult.affectedRows || 0} orphaned attendees.`);

        res.status(200).json({ message: 'Event and orphaned attendees deleted successfully!' });
    } catch (error) {
        console.error('Error deleting event:', error);
        res.status(500).json({ error: 'Failed to delete event' });
    }
});


// --- ROUTE: PATCH (Update) an Event ---
app.patch('/api/events/:id', async (req, res) => {
    const eventId = req.params.id;
    const updates = req.body; // e.g., { "venue": "New Room" }

    // If the body is empty, don't waste time querying the database
    if (Object.keys(updates).length === 0) {
        return res.status(400).json({ error: 'No data provided to update' });
    }

    try {
        // 1. Get the existing event to find its google_event_id
        const [eventRows] = await pool.execute(`SELECT * FROM Events WHERE event_id = ?`, [eventId]);
        if (eventRows.length === 0) return res.status(404).json({ error: 'Event not found' });
        
        const existingEvent = eventRows[0];
        const googleEventId = existingEvent.google_event_id;

        // 2. Build the dynamic SQL query for updating MySQL
        const fields = [];
        const values = [];
        
        for (const [key, value] of Object.entries(updates)) {
            // We only update standard fields (ignoring attendees for this simple patch)
            if (['title', 'description', 'venue', 'event_date', 'start_time', 'end_time'].includes(key)) {
                fields.push(`${key} = ?`);
                values.push(value);
            }
        }

        if (fields.length > 0) {
            values.push(eventId); // Add ID for the WHERE clause
            const query = `UPDATE Events SET ${fields.join(', ')} WHERE event_id = ?`;
            await pool.execute(query, values);
        }

        // 3. Update Google Calendar
        if (googleEventId) {
            // We merge existing data with the updates so Google has the full date/time context
            const mergedData = { ...existingEvent, ...updates };
            await updateGoogleEvent(googleEventId, mergedData);
        }

        res.status(200).json({ message: 'Event updated successfully!' });
    } catch (error) {
        console.error('Error updating event:', error);
        res.status(500).json({ error: 'Failed to update event' });
    }
});

// --- DATABASE-POWERED MANUAL LOGIN ---
app.post('/api/auth/manual', async (req, res) => {
    const { email, password } = req.body;

    if (!email || !password) {
        return res.status(400).json({ success: false, message: 'Email and password are required' });
    }

    try {
        // Look up the user in MySQL
        const [rows] = await pool.execute('SELECT * FROM users WHERE email = ?', [email.toLowerCase()]);
        const user = rows[0]; // Get the first user found

        // If user exists AND the password matches
        if (user && user.password === password) {
            console.log(`Manual login success: ${email} as ${user.role}`);
            return res.json({ success: true, role: user.role });
        }

        // If wrong email or wrong password
        return res.status(401).json({ success: false, message: 'Invalid email or password' });

    } catch (error) {
        console.error('Database error during login:', error);
        res.status(500).json({ success: false, message: 'Server error' });
    }
});

// --- NEW: Manual Sign Up Route ---
app.post('/api/auth/signup', async (req, res) => {
    const { name, email, password } = req.body; // Catch 'name' here

    if (!name || !email || !password) {
        return res.status(400).json({ success: false, message: 'All fields are required' });
    }

    try {
        const [existing] = await pool.execute('SELECT * FROM users WHERE email = ?', [email]);
        if (existing.length > 0) {
            return res.status(400).json({ success: false, message: 'User already exists' });
        }

        // Insert the actual 'name' provided by the user
        await pool.execute(
            'INSERT INTO users (name, email, password, role) VALUES (?, ?, ?, ?)',
            [name, email.toLowerCase(), password, 'user']
        );

        console.log(`✅ New user registered: ${name} (${email})`);
        res.json({ success: true, role: 'user' });

    } catch (error) {
        console.error('❌ SIGNUP ERROR:', error);
        res.status(500).json({ success: false });
    }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});