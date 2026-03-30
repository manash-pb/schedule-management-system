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
        oauth2Client.setCredentials(tokens);

        const oauth2 = google.oauth2({ version: 'v2', auth: oauth2Client });
        const userInfo = await oauth2.userinfo.get();

        const googleId = userInfo.data.id;
        const email = userInfo.data.email.toLowerCase();
        const name = userInfo.data.name;

        // Check if the user exists
        const [rows] = await pool.execute('SELECT * FROM users WHERE email = ?', [email]);
        let user = rows[0];

        // We convert the tokens object to a JSON string for MySQL
        const tokenString = JSON.stringify(tokens);

        if (user) {
            // Update existing user: Link Google ID and SAVE TOKENS
            await pool.execute(
                'UPDATE users SET google_id = ?, google_tokens = ? WHERE email = ?', 
                [googleId, tokenString, email]
            );
            console.log(`✅ Updated tokens for: ${email}`);
        } else {
            // Create new user with tokens
            await pool.execute(
                'INSERT INTO users (name, email, google_id, google_tokens, role) VALUES (?, ?, ?, ?, ?)', 
                [name, email, googleId, tokenString, 'user']
            );
            console.log(`✅ Created user and saved tokens: ${email}`);
            
            const [newRows] = await pool.execute('SELECT role FROM users WHERE email = ?', [email]);
            user = newRows[0];
        }

        // Redirect with role
        const finalRole = user ? user.role : 'user';
        res.redirect(`http://localhost:5173/?login=success&role=${finalRole}`);

    } catch (error) {
        console.error('Error during Google authentication:', error);
        res.status(500).send('Authentication failed');
    }
});

// --- THE MISSING "ENTRY" ROUTE ---
app.get('/auth/google', (req, res) => {
    // 1. Define the permissions (scopes) we need
    const scopes = [
        'https://www.googleapis.com/auth/userinfo.profile',
        'https://www.googleapis.com/auth/userinfo.email',
        'https://www.googleapis.com/auth/calendar' // Needed to create events
    ];

    // 2. Generate the URL that sends the user to Google
    const url = oauth2Client.generateAuthUrl({
        access_type: 'offline', // CRITICAL: Gets a refresh_token so login lasts longer
        scope: scopes,
        prompt: 'consent' // Forces Google to show the "Allow" screen for Calendar
    });

    // 3. Redirect the browser to Google
    res.redirect(url);
});

// --- ROUTE: Get All Events with Attendees ---
app.get('/api/events', async (req, res) => {
    try {
        // 1. Fetch all events, ordered by date and time
        const [events] = await pool.execute(
            `SELECT * FROM Events ORDER BY event_date ASC, start_time ASC`
        );

        // 2. Fetch all attendees and their associated event_ids
        const [attendees] = await pool.execute(`
            SELECT ea.event_id, a.name, a.email 
            FROM Event_Attendees ea
            JOIN Attendees a ON ea.attendee_id = a.attendee_id
        `);

        // 3. Attach the attendees to their respective events using JavaScript
        const eventsWithAttendees = events.map(event => {
            // Filter out only the attendees that belong to this specific event
            const eventAttendees = attendees
                .filter(a => a.event_id === event.event_id)
                .map(a => ({ name: a.name, email: a.email })); // Clean up the output

            return {
                ...event, // Spread all event details (title, venue, etc.)
                attendees: eventAttendees // Add the attendees array
            };
        });

        // 4. Send the perfectly formatted data back to the user/frontend
        res.status(200).json(eventsWithAttendees);

    } catch (error) {
        console.error('Error fetching events:', error);
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

// --- ROUTE: DELETE an Event ---
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

        // 3. Delete from MySQL (Attendees link will auto-delete due to ON DELETE CASCADE)
        await pool.execute(`DELETE FROM Events WHERE event_id = ?`, [eventId]);

        res.status(200).json({ message: 'Event deleted successfully!' });
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