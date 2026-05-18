const pool = require('../db');

exports.getNotifications = async (req, res) => {
    const email = req.query.email;
    if (!email) {
        return res.status(400).json({ error: 'Email is required' });
    }

    try {
        // Fetch all notifications. Also check if this user has read them.
        const query = `
            SELECT 
                n.id, 
                n.subject,
                n.message, 
                n.attachment_path,
                n.attachment_name,
                n.created_at,
                IF(un.notification_id IS NOT NULL, true, false) as is_read
            FROM notifications n
            LEFT JOIN user_notifications un ON n.id = un.notification_id AND un.user_email = ?
            ORDER BY n.created_at DESC
        `;
        const [rows] = await pool.query(query, [email]);

        // Map to a friendlier frontend format (e.g. read instead of is_read, time format)
        const notifications = rows.map(row => {
            // Return a download endpoint so we can control filename on download
            const downloadUrl = row.attachment_path ? `${req.protocol}://${req.get('host')}/api/notifications/${row.id}/attachment` : null;

            return {
                id: row.id,
                subject: row.subject,
                text: row.message,
                attachment: downloadUrl,
                attachmentName: row.attachment_name || null,
                time: new Date(row.created_at).toLocaleString(),
                read: !!row.is_read
            };
        });

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

    const storedFilename = req.file ? req.file.filename : null;
    const originalName = req.file ? req.file.originalname : null;

    // Build a public URL for the attachment if present
    const attachmentUrl = storedFilename ? `${req.protocol}://${req.get('host')}/uploads/notifications/${storedFilename}` : null;

    try {
        // Insert attachment path (public URL) and attachment_name (original filename) if column exists
        const [result] = await pool.query(
            'INSERT INTO notifications (subject, message, attachment_path, attachment_name) VALUES (?, ?, ?, ?)', 
            [subject || null, message, attachmentUrl, originalName]
        );
        res.status(201).json({ id: result.insertId, subject, message, attachment: attachmentUrl, attachmentName: originalName, success: true });
    } catch (error) {
        console.error('Error creating notification:', error);
        res.status(500).json({ error: 'Failed to create notification' });
    }
};

exports.deleteNotification = async (req, res) => {
    const { id } = req.params;
    try {
        // Before deleting, try to remove attachment file from disk if present
        const [rows] = await pool.query('SELECT attachment_path FROM notifications WHERE id = ?', [id]);
        const attachmentPath = rows[0]?.attachment_path;
        if (attachmentPath && attachmentPath.includes('/uploads/notifications/')) {
            const filename = attachmentPath.split('/').pop();
            const fs = require('fs');
            const path = require('path');
            const filePath = path.join(__dirname, '..', 'uploads', 'notifications', filename);
            fs.unlink(filePath, (err) => {
                if (err) console.error('Failed to delete attachment file:', err);
            });
        }

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
        // Fetch all current notification IDs
        const [notifications] = await pool.query('SELECT id FROM notifications');
        if (notifications.length === 0) {
            return res.json({ success: true });
        }

        // Prepare bulk insert
        const values = notifications.map(n => [email, n.id]);
        
        // Using IGNORE so if it already exists, it doesn't fail
        await pool.query('INSERT IGNORE INTO user_notifications (user_email, notification_id) VALUES ?', [values]);

        res.json({ success: true });
    } catch (error) {
        console.error('Error marking as read:', error);
        res.status(500).json({ error: 'Failed to mark notifications as read' });
    }
};

exports.downloadAttachment = async (req, res) => {
    const { id } = req.params;
    try {
        const [rows] = await pool.query('SELECT attachment_path, attachment_name FROM notifications WHERE id = ?', [id]);
        const attachmentPath = rows[0]?.attachment_path;
        const attachmentName = rows[0]?.attachment_name || null;
        if (!attachmentPath) return res.status(404).json({ error: 'Attachment not found' });

        // derive filename on disk from URL
        const filename = attachmentPath.split('/').pop();
        const path = require('path');
        const filePath = path.join(__dirname, '..', 'uploads', 'notifications', filename);

        // Use res.download to set Content-Disposition with original filename
        return res.download(filePath, attachmentName || filename, (err) => {
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
