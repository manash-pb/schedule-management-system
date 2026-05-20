const express = require('express');
const router = express.Router();
const { verifyToken, requireAdmin } = require('../middleware/authMiddleware');
const { sendUserQuery, getMyQueries, getQueries, replyToQuery, markQueryAsRead } = require('../controllers/queryController');

router.post('/', verifyToken, sendUserQuery);
router.get('/my-queries', verifyToken, getMyQueries);
router.get('/', verifyToken, requireAdmin, getQueries);
router.post('/:id/reply', verifyToken, requireAdmin, replyToQuery);
router.patch('/:id/read', verifyToken, requireAdmin, markQueryAsRead);

module.exports = router;
