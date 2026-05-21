const express = require('express');
const router = express.Router();
const { verifyToken, requireAdmin } = require('../middleware/authMiddleware');
const { 
  sendUserQuery, 
  getMyQueries, 
  getQueries, 
  replyToQuery, 
  markQueryAsRead,
  deleteQuery,
  clearMyHistory,
  clearAllHistory
} = require('../controllers/queryController');

router.post('/', verifyToken, sendUserQuery);
router.get('/my-queries', verifyToken, getMyQueries);
router.get('/', verifyToken, requireAdmin, getQueries);
router.post('/:id/reply', verifyToken, requireAdmin, replyToQuery);
router.patch('/:id/read', verifyToken, requireAdmin, markQueryAsRead);

// Deletion endpoints (Specific before parameterized)
router.delete('/clear/my-history', verifyToken, clearMyHistory);
router.delete('/clear/all', verifyToken, requireAdmin, clearAllHistory);
router.delete('/:id', verifyToken, deleteQuery);

module.exports = router;
