const express = require('express');
const router = express.Router();
const { verifyToken, requireAdmin } = require('../middleware/authMiddleware');
const notificationController = require('../controllers/notificationController');
const multer = require('multer');
const path = require('path');
const fs = require('fs');

const uploadDir = path.join(__dirname, '..', 'uploads', 'notifications');
if (!fs.existsSync(uploadDir)) {
    fs.mkdirSync(uploadDir, { recursive: true });
}

const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        cb(null, 'uploads/notifications/');
    },
    filename: function (req, file, cb) {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        cb(null, 'attachment-' + uniqueSuffix + path.extname(file.originalname));
    }
});
const upload = multer({ storage: storage });

router.get('/', notificationController.getNotifications);
router.post('/read', verifyToken, notificationController.markAllAsRead);

// Admin only routes
router.post('/', verifyToken, requireAdmin, upload.single('attachment'), notificationController.createNotification);
router.delete('/:id', verifyToken, requireAdmin, notificationController.deleteNotification);
// Download attachment for a notification (sets original filename)
router.get('/:id/attachment', verifyToken, notificationController.downloadAttachment);

module.exports = router;
