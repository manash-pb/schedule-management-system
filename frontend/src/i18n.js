import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';

i18n.use(initReactI18next).init({
  lng: 'en',
  fallbackLng: 'en',
  resources: {
    en: {
      translation: {
        // AdminDashboard labels
        createEvent: 'Create Event',
        eventTitle: 'Event Title',
        description: 'Add a brief description...',
        venue: 'Venue or Meeting Link',
        startTime: 'Start Time',
        endTime: 'End Time',
        inviteGuests: 'Invite Guests',
        importExcel: 'Import Excel',
        guestName: 'Guest Name',
        guestEmail: 'Guest Email',
        clearAll: 'Clear all',
        scheduleAndSend: 'Schedule & Send Invites',
        creating: 'Creating...',
        upcomingEvents: 'Upcoming Events',
        liveEvents: '🔴 Live Events',
        pastEvents: 'Past Events',
        upcoming: 'Upcoming',
        live: '🔴 Live',
        past: 'Past',
        logout: 'Logout',
        connectCalendar: 'Connect Google Calendar',
        calendarWarning: "Google Calendar is not connected. Events won't sync until you connect.",
        attendees: 'Attendees',
        noAttendees: 'No attendees added.',
        noEvents: 'No {{tab}} events.',
        confirmed: 'Confirmed',
        downloadExcel: 'Download Excel',
        preview: 'Preview',
        delete: 'Delete',
        guest_one: '{{count}} guest',
        guest_other: '{{count}} guests',
        columnsHint: 'Columns: name, email',
      },
    },
  },
  interpolation: { escapeValue: false },
});

export default i18n;
