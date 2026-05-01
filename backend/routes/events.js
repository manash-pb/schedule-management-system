const express = require('express');
const router = express.Router();
const { createEvent, getEvents, deleteEvent, deleteAllEvents, updateEvent, rsvpEvent, addAttendee, removeAttendee } = require('../controllers/eventController');

router.post('/', createEvent);
router.get('/', getEvents);
router.delete('/', deleteAllEvents);
router.delete('/:id', deleteEvent);
router.patch('/:id/rsvp', rsvpEvent);
router.get('/:id/rsvp', rsvpEvent);
router.post('/:id/attendees', addAttendee);
router.delete('/:id/attendees/:email', removeAttendee);
router.patch('/:id', updateEvent);

module.exports = router;
