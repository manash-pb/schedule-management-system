const express = require('express');
const router = express.Router();
const { createEvent, getEvents, deleteEvent, deleteAllEvents, updateEvent, rsvpEvent, addAttendee, removeAttendee } = require('../controllers/eventController');
const { verifyToken, requireAdmin } = require('../middleware/authMiddleware');

// Public: RSVP (attendees click from email, no login)
router.patch('/:id/rsvp', rsvpEvent);
router.get('/:id/rsvp', rsvpEvent);

// Any logged-in user
router.get('/', verifyToken, getEvents);

// Admin only
router.post('/', verifyToken, requireAdmin, createEvent);
router.delete('/', verifyToken, requireAdmin, deleteAllEvents);
router.delete('/:id', verifyToken, requireAdmin, deleteEvent);
router.patch('/:id', verifyToken, requireAdmin, updateEvent);
router.post('/:id/attendees', verifyToken, requireAdmin, addAttendee);
router.delete('/:id/attendees/:email', verifyToken, requireAdmin, removeAttendee);

module.exports = router;
