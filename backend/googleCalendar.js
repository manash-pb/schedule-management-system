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
        access_type: 'offline', // Requests a refresh token
        scope: ['https://www.googleapis.com/auth/calendar.events']
    });
}

// 3. Create the Event using the authenticated user's calendar
async function createGoogleEvent(eventData, attendees) {
    try {
        // Pass the OAuth client to the Calendar API
        const calendar = google.calendar({ version: 'v3', auth: oauth2Client });
        
        const attendeeList = attendees.map(person => ({ email: person.email }));

        const event = {
            summary: eventData.title,
            description: eventData.description,
            location: eventData.venue,
            start: {
                dateTime: `${eventData.event_date}T${eventData.start_time}`,
                timeZone: 'Asia/Kolkata', 
            },
            end: {
                dateTime: `${eventData.event_date}T${eventData.end_time}`,
                timeZone: 'Asia/Kolkata',
            },
            attendees: attendeeList,
            reminders: { useDefault: true },
        };

        const response = await calendar.events.insert({
            calendarId: 'primary', // 'primary' now means "the calendar of the user who signed in"
            resource: event,
            sendUpdates: 'all',
        });

        return response.data.id;
    } catch (error) {
        console.error('Error in Google Calendar OAuth:', error);
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