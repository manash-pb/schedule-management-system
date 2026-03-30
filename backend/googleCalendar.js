const { google } = require('googleapis');
require('dotenv').config();

// 1. Initialize the OAuth2 Client
const oauth2Client = new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
    process.env.GOOGLE_REDIRECT_URI
);

// 2. Generate the "Sign In With Google" URL
function getAuthUrl() {
    return oauth2Client.generateAuthUrl({
        access_type: 'offline',
        prompt: 'consent', // <-- THE MAGIC FIX! Forces Google to re-ask for permissions
        scope: [
            'https://www.googleapis.com/auth/calendar',
            'https://www.googleapis.com/auth/userinfo.email',   // Required to get the email
            'https://www.googleapis.com/auth/userinfo.profile'  // Required to get the name
        ]
    });
}

// backend/googleCalendar.js

// backend/googleCalendar.js

async function createGoogleEvent(eventData, attendees, tokens) {
    try {
        if (!tokens) {
            throw new Error("No Google tokens provided to createGoogleEvent");
        }

        // 1. Feed the tokens into the client
        oauth2Client.setCredentials(tokens);

        const calendar = google.calendar({ version: 'v3', auth: oauth2Client });
        
        // 2. Map attendees to the format Google expects
        const attendeeList = attendees.map(person => ({ email: person.email }));

        // 3. Construct the event object
        const event = {
            summary: eventData.title,
            description: eventData.description,
            location: eventData.venue,
            start: {
                // Use the strings we prepared in server.js
                dateTime: eventData.startISO, 
                timeZone: 'Asia/Kolkata', 
            },
            end: {
                dateTime: eventData.endISO, 
                timeZone: 'Asia/Kolkata',
            },
            attendees: attendeeList,
            // Adds a Google Meet link automatically!
            conferenceData: {
                createRequest: { requestId: `meet-${Date.now()}` }
            },
            reminders: { useDefault: true },
        };

        // 4. Send to Google
        const response = await calendar.events.insert({
            calendarId: 'primary',
            resource: event,
            sendUpdates: 'all',
            conferenceDataVersion: 1, // Required to generate the Meet link
        });

        console.log(`✅ Google Event Created: ${response.data.htmlLink}`);
        return response.data.id;

    } catch (error) {
        // If the token is expired, Google returns a 401. 
        // This is where you would eventually add "refresh token" logic.
        console.error('Error in Google Calendar API:', error.response?.data || error.message);
        throw error;
    }
}

// --- Function to UPDATE an existing event ---
async function updateGoogleEvent(googleEventId, updates) {
    try {
        const calendar = google.calendar({ version: 'v3', auth: oauth2Client });
        
        // Map the database column names to Google's specific field names
        const eventPatch = {};
        if (updates.title) eventPatch.summary = updates.title;
        if (updates.description) eventPatch.description = updates.description;
        if (updates.venue) eventPatch.location = updates.venue;
        
        // If the date or time changes, format it for Google
        if (updates.event_date && updates.start_time) {
            eventPatch.start = { dateTime: `${updates.event_date}T${updates.start_time}`, timeZone: 'Asia/Kolkata' };
        }
        if (updates.event_date && updates.end_time) {
            eventPatch.end = { dateTime: `${updates.event_date}T${updates.end_time}`, timeZone: 'Asia/Kolkata' };
        }

        await calendar.events.patch({
            calendarId: 'primary',
            eventId: googleEventId,
            resource: eventPatch,
            sendUpdates: 'all' // Sends an "Updated Invitation" email to attendees!
        });
    } catch (error) {
        console.error('Error updating Google Event:', error);
        throw error;
    }
}

// --- Function to DELETE an existing event ---
async function deleteGoogleEvent(googleEventId) {
    try {
        const calendar = google.calendar({ version: 'v3', auth: oauth2Client });
        await calendar.events.delete({
            calendarId: 'primary',
            eventId: googleEventId,
            sendUpdates: 'all' // Sends a "Canceled Event" email to attendees!
        });
    } catch (error) {
        console.error('Error deleting Google Event:', error);
        throw error;
    }
}

module.exports = { oauth2Client, getAuthUrl, createGoogleEvent, updateGoogleEvent, deleteGoogleEvent };