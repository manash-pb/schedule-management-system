const express = require('express');
const router = express.Router();
const { createEvent, getEvents, deleteEvent, deleteAllEvents, updateEvent } = require('../controllers/eventController');

router.post('/', createEvent);
router.get('/', getEvents);
router.delete('/', deleteAllEvents);
router.delete('/:id', deleteEvent);
router.patch('/:id', updateEvent);

module.exports = router;
