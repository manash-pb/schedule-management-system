// server.js (Updated)
const { oauth2Client, getAuthUrl, createGoogleEvent, updateGoogleEvent, deleteGoogleEvent } = require('./googleCalendar');
const express = require('express');
const cors = require('cors');
const pool = require('./db');
const { startCronJobs } = require('./cronJobs'); // Import Cron Job logic
require('dotenv').config();

const app = express();
app.use(cors());
app.use(express.json());

// Start the background cron jobs
startCronJobs();

app.post('/api/events', async (req, res) => {
    // We assign '= null' so if the frontend forgets a field, it defaults to null instead of undefined!
    // Use 'let' instead of 'const' so we can append the seconds!
        let { 
            title = null, 
            description = null, 
            venue = null, 
            event_date = null, 
            start_time = null, 
            end_time = null, 
            attendees = [] 
        } = req.body;

        // Google Calendar strictly requires seconds in the time string.
        // If the frontend only sends "12:00" (5 characters), we add ":00" to make it "12:00:00"
        if (start_time && start_time.length === 5) start_time += ':00';
        if (end_time && end_time.length === 5) end_time += ':00';

    // Add this line just to see what React is actually sending:
    console.log("Incoming Data:", req.body);
    let connection;

    try {
        connection = await pool.getConnection();
        await connection.beginTransaction();

        // 1. Insert into MySQL (Events Table)
        const [eventResult] = await connection.execute(
            `INSERT INTO Events (title, description, venue, event_date, start_time, end_time) VALUES (?, ?, ?, ?, ?, ?)`,
            [title, description, venue, event_date, start_time, end_time]
        );
        const newEventId = eventResult.insertId;

        // 2. Insert Attendees
        if (attendees && attendees.length > 0) {
            for (let person of attendees) {
                // FALLBACK: If name is missing, use 'Guest'
                const attendeeName = person.name || 'Guest'; 
                
                await connection.execute(
                    `INSERT IGNORE INTO Attendees (name, email) VALUES (?, ?)`, 
                    [attendeeName, person.email]
                );
                
                const [attendeeRecord] = await connection.execute(
                    `SELECT attendee_id FROM Attendees WHERE email = ?`, 
                    [person.email]
                );
                const attendeeId = attendeeRecord[0].attendee_id;

                await connection.execute(
                    `INSERT INTO Event_Attendees (event_id, attendee_id) VALUES (?, ?)`, 
                    [newEventId, attendeeId]
                );
            }
        }

        // 3. Sync to Google Calendar
        const eventData = { title, description, venue, event_date, start_time, end_time };
        const googleEventId = await createGoogleEvent(eventData, attendees);

        // 4. Update MySQL with the Google Event ID
        await connection.execute(
            `UPDATE Events SET google_event_id = ? WHERE event_id = ?`,
            [googleEventId, newEventId]
        );

        await connection.commit(); // Save transaction
        
        res.status(201).json({ 
            message: 'Event created and synced to Google Calendar successfully!', 
            eventId: newEventId,
            googleEventId: googleEventId
        });

    } catch (error) {
        if (connection) await connection.rollback();
        console.error('API Error:', error);
        res.status(500).json({ error: 'Failed to create event' });
    } finally {
        if (connection) connection.release();
    }
});

// --- ROUTE 1: Send user to Google Login ---
app.get('/auth/google', (req, res) => {
    const url = getAuthUrl();
    res.redirect(url); // Redirects the browser to Google's consent screen
});

// --- ROUTE 2: Google sends the user back here ---
app.get('/auth/google/callback', async (req, res) => {
    const code = req.query.code; // Google gives us a special code in the URL
    
    try {
        // Exchange the code for an Access Token
        const { tokens } = await oauth2Client.getToken(code);
        
        // Save the tokens in the client
        oauth2Client.setCredentials(tokens);
        
        res.send('<h3>Login Successful!</h3><p>Your app is now connected to your Google Calendar. You can return to Postman and test the POST /api/events route.</p>');
    } catch (error) {
        console.error('Error retrieving access token', error);
        res.status(500).send('Authentication failed');
    }
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

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});