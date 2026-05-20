const express = require('express');
const router = express.Router();
const { createEvent, getEvents, deleteEvent, deleteAllEvents, updateEvent, addAttendee, removeAttendee } = require('../controllers/eventController');
const { verifyToken, requireAdmin } = require('../middleware/authMiddleware');

// RSVP routes removed

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
