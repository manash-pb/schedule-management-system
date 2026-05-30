const express = require('express');
const router = express.Router();
const feedbackController = require('../controllers/feedbackController');
const { verifyToken, requireAdmin } = require('../middleware/authMiddleware');

router.post('/generate/:eventId', verifyToken, requireAdmin, feedbackController.generateForm);
router.post('/send/:eventId', verifyToken, requireAdmin, feedbackController.sendForm);
router.get('/stats/:eventId', verifyToken, feedbackController.getStats);

module.exports = router;
