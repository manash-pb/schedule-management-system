const pool = require('../db');

exports.getNotifications = async (req, res) => {
    const email = req.query.email;
    if (!email) {
        return res.status(400).json({ error: 'Email is required' });
    }

    try {
        // Fetch all notifications with read status
        const notifQuery = `
            SELECT 
                n.id, 
                n.subject,
                n.message, 
                n.created_at,
                IF(un.notification_id IS NOT NULL, true, false) as is_read
            FROM notifications n
            LEFT JOIN user_notifications un ON n.id = un.notification_id AND un.user_email = ?
            ORDER BY n.created_at DESC
        `;
        const [rows] = await pool.query(notifQuery, [email]);

        if (rows.length === 0) return res.json([]);

        // Fetch all attachments for these notifications in one query
        const notifIds = rows.map(r => r.id);
        const [attachRows] = await pool.query(
            `SELECT id, notification_id, file_path, file_name FROM notification_attachments WHERE notification_id IN (?)`,
            [notifIds]
        );

        // Group attachments by notification_id
        const attachMap = {};
        for (const a of attachRows) {
            if (!attachMap[a.notification_id]) attachMap[a.notification_id] = [];
            attachMap[a.notification_id].push({
                id: a.id,
                url: `${req.protocol}://${req.get('host')}/api/notifications/attachment/${a.id}`,
                name: a.file_name
            });
        }

        const notifications = rows.map(row => ({
            id: row.id,
            subject: row.subject,
            text: row.message,
            attachments: attachMap[row.id] || [],
            time: new Date(row.created_at).toLocaleString(),
            read: !!row.is_read
        }));

        res.json(notifications);
    } catch (error) {
        console.error('Error fetching notifications:', error);
        res.status(500).json({ error: 'Failed to fetch notifications' });
    }
};

exports.createNotification = async (req, res) => {
    const { subject, message } = req.body;
    if (!message) {
        return res.status(400).json({ error: 'Message is required' });
    }

    const files = req.files || []; // array from upload.array()

    try {
        // Insert the notification
        const [result] = await pool.query(
            'INSERT INTO notifications (subject, message) VALUES (?, ?)',
            [subject || null, message]
        );
        const notificationId = result.insertId;

        // Insert each attachment into notification_attachments
        if (files.length > 0) {
            const attachmentValues = files.map(file => {
                const fileUrl = `${req.protocol}://${req.get('host')}/uploads/notifications/${file.filename}`;
                return [notificationId, fileUrl, file.originalname];
            });
            await pool.query(
                'INSERT INTO notification_attachments (notification_id, file_path, file_name) VALUES ?',
                [attachmentValues]
            );
        }

        const newNotification = { id: notificationId, subject, message, success: true };

        // --- NEW SOCKET.IO LOGIC ---
        // Grab the 'io' instance we saved in server.js
        const io = req.app.get('io');
        if (io) {
            // Broadcast the new notification to all connected users
            io.emit('new_notification_posted', newNotification);
        }
        // ---------------------------

        res.status(201).json(newNotification);
    } catch (error) {
        console.error('Error creating notification:', error);
        res.status(500).json({ error: 'Failed to create notification' });
    }
};

exports.deleteNotification = async (req, res) => {
    const { id } = req.params;
    try {
        // Fetch all attachments so we can delete the files from disk
        const [attachRows] = await pool.query(
            'SELECT file_path FROM notification_attachments WHERE notification_id = ?',
            [id]
        );

        const fs = require('fs');
        const path = require('path');
        for (const row of attachRows) {
            if (row.file_path && row.file_path.includes('/uploads/notifications/')) {
                const filename = row.file_path.split('/').pop();
                const filePath = path.join(__dirname, '..', 'uploads', 'notifications', filename);
                fs.unlink(filePath, (err) => {
                    if (err) console.error('Failed to delete attachment file:', err);
                });
            }
        }

        // The CASCADE on the FK will delete notification_attachments rows automatically
        await pool.query('DELETE FROM notifications WHERE id = ?', [id]);
        res.json({ success: true });
    } catch (error) {
        console.error('Error deleting notification:', error);
        res.status(500).json({ error: 'Failed to delete notification' });
    }
};

exports.markAllAsRead = async (req, res) => {
    const { email } = req.body;
    if (!email) {
        return res.status(400).json({ error: 'Email is required' });
    }

    try {
        const [notifications] = await pool.query('SELECT id FROM notifications');
        if (notifications.length === 0) {
            return res.json({ success: true });
        }

        const values = notifications.map(n => [email, n.id]);
        await pool.query('INSERT IGNORE INTO user_notifications (user_email, notification_id) VALUES ?', [values]);

        res.json({ success: true });
    } catch (error) {
        console.error('Error marking as read:', error);
        res.status(500).json({ error: 'Failed to mark notifications as read' });
    }
};

exports.downloadAttachment = async (req, res) => {
    const { attachmentId } = req.params;
    try {
        const [rows] = await pool.query(
            'SELECT file_path, file_name FROM notification_attachments WHERE id = ?',
            [attachmentId]
        );
        if (!rows[0]) return res.status(404).json({ error: 'Attachment not found' });

        const { file_path, file_name } = rows[0];
        const filename = file_path.split('/').pop();
        const path = require('path');
        const filePath = path.join(__dirname, '..', 'uploads', 'notifications', filename);

        return res.download(filePath, file_name || filename, (err) => {
            if (err) {
                console.error('Error sending attachment:', err);
                return res.status(500).end();
            }
        });
    } catch (error) {
        console.error('Error fetching attachment:', error);
        res.status(500).json({ error: 'Failed to fetch attachment' });
    }
};
