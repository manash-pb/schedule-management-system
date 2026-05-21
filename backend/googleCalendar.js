const { google } = require('googleapis');

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

        oauth2Client.setCredentials(tokens);
        const calendar = google.calendar({ version: 'v3', auth: oauth2Client });

        // Map attendees for the .ics but don't add them to the Google event
        // (avoids Google sending its own notification emails)
        const attendeeList = [];

        const event = {
            summary: eventData.title,
            description: eventData.description,
            location: eventData.venue,
            start: { dateTime: eventData.startISO, timeZone: 'Asia/Kolkata' },
            end:   { dateTime: eventData.endISO,   timeZone: 'Asia/Kolkata' },
            attendees: attendeeList,
            reminders: { useDefault: true },
        };

        const insertParams = {
            calendarId: 'primary',
            resource: event,
            sendUpdates: 'none',
        };

        const response = await calendar.events.insert(insertParams);
        console.log(`✅ Google Event Created: ${response.data.htmlLink}`);
        return response.data.id;

    } catch (error) {
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
async function deleteGoogleEvent(googleEventId, tokens) {
    try {
        oauth2Client.setCredentials(tokens);
        const calendar = google.calendar({ version: 'v3', auth: oauth2Client });
        await calendar.events.delete({
            calendarId: 'primary',
            eventId: googleEventId,
            sendUpdates: 'none',
        });
    } catch (error) {
        if (error.status === 404 || error.code === 404) {
            console.warn(`Google event ${googleEventId} not found, skipping delete.`);
            return;
        }
        console.error('Error deleting Google Event:', error);
        throw error;
    }
}

async function generateMeetLink(tokens) {
    oauth2Client.setCredentials(tokens);
    const calendar = google.calendar({ version: 'v3', auth: oauth2Client });
    const response = await calendar.events.insert({
        calendarId: 'primary',
        conferenceDataVersion: 1,
        resource: {
            summary: 'Meeting',
            start: { dateTime: new Date().toISOString(), timeZone: 'Asia/Kolkata' },
            end:   { dateTime: new Date(Date.now() + 3600000).toISOString(), timeZone: 'Asia/Kolkata' },
            conferenceData: { createRequest: { requestId: `meet-${Date.now()}` } },
        },
    });
    const meetLink = response.data.conferenceData?.entryPoints?.find(e => e.entryPointType === 'video')?.uri;
    // Delete the placeholder event immediately
    await calendar.events.delete({ calendarId: 'primary', eventId: response.data.id, sendUpdates: 'none' }).catch(() => {});
    return meetLink;
}

module.exports = { oauth2Client, getAuthUrl, createGoogleEvent, updateGoogleEvent, deleteGoogleEvent, generateMeetLink };