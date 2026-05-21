const pool = require('../db');
const { sendQueryToAdmins, sendUserReplyEmail } = require('../utils/mailer');

exports.sendUserQuery = async (req, res) => {
  const { subject, message } = req.body;
  const userEmail = req.user?.email;

  if (!userEmail || !subject || !subject.trim() || !message || !message.trim()) {
    return res.status(400).json({ error: 'Subject and message are required.' });
  }

  let userName = req.user?.name || 'User';
  try {
    const [rows] = await pool.execute('SELECT name FROM users WHERE email = ? LIMIT 1', [userEmail]);
    if (rows[0]?.name) userName = rows[0].name;
  } catch (err) {
    console.warn('Could not fetch user name for query:', err.message || err);
  }

  try {
    const [result] = await pool.execute(
      'INSERT INTO user_queries (user_name, user_email, subject, message) VALUES (?, ?, ?, ?)',
      [userName, userEmail, subject || null, message.trim()]
    );

    await sendQueryToAdmins({
      fromName: userName,
      fromEmail: userEmail,
      subject: subject || '',
      message: message.trim(),
    });

    return res.json({ success: true, id: result.insertId, message: 'Your query has been sent to admin.' });
  } catch (error) {
    console.error('Failed to send user query:', error.message || error);
    return res.status(500).json({ error: 'Failed to send your query to admins. Please try again later.' });
  }
};

exports.getMyQueries = async (req, res) => {
  const userEmail = req.user?.email;
  if (!userEmail) {
    return res.status(401).json({ error: 'Unauthorized.' });
  }

  try {
    const [rows] = await pool.execute(
      `SELECT id, user_name, user_email, subject, message, reply_message, status, created_at, reply_at, replied_by
       FROM user_queries
       WHERE user_email = ? AND deleted_by_user = 0
       ORDER BY created_at DESC`,
      [userEmail]
    );
    return res.json(rows);
  } catch (error) {
    console.error('Failed to fetch user queries:', error.message || error);
    return res.status(500).json({ error: 'Failed to fetch your queries.' });
  }
};

exports.getQueries = async (req, res) => {
  try {
    const [rows] = await pool.execute(
      `SELECT id, user_name, user_email, subject, message, reply_message, status, created_at, reply_at, replied_by
       FROM user_queries
       WHERE deleted_by_admin = 0
       ORDER BY status = 'new' DESC, created_at DESC`
    );
    return res.json(rows);
  } catch (error) {
    console.error('Failed to fetch queries:', error.message || error);
    return res.status(500).json({ error: 'Failed to fetch user queries.' });
  }
};

exports.replyToQuery = async (req, res) => {
  const queryId = req.params.id;
  const { reply, expectedLastReplyAt } = req.body;
  const adminEmail = req.user?.email;
  const adminName = req.user?.name || adminEmail || 'Admin';

  if (!reply || !reply.trim()) {
    return res.status(400).json({ error: 'Reply message cannot be empty.' });
  }

  try {
    const [rows] = await pool.execute('SELECT user_email, user_name, subject, message, reply_at FROM user_queries WHERE id = ?', [queryId]);
    if (!rows.length) {
      return res.status(404).json({ error: 'Query not found.' });
    }

    const query = rows[0];

    // Optimistic Concurrency Control (OCC) Check to prevent concurrent overwrites
    const actualTimeSec = query.reply_at ? Math.floor(new Date(query.reply_at).getTime() / 1000) : null;
    const expectedTimeSec = expectedLastReplyAt ? Math.floor(new Date(expectedLastReplyAt).getTime() / 1000) : null;

    if (actualTimeSec !== expectedTimeSec) {
      return res.status(409).json({
        error: 'This query has been answered or updated by another administrator. Please check the latest reply before sending yours.'
      });
    }

    await sendUserReplyEmail({
      toName: query.user_name || query.user_email,
      toEmail: query.user_email,
      querySubject: query.subject || 'Your query',
      originalMessage: query.message,
      replyMessage: reply.trim(),
    });

    await pool.execute(
      'UPDATE user_queries SET reply_message = ?, reply_at = NOW(), replied_by = ?, status = ? WHERE id = ?',
      [reply.trim(), adminEmail || adminName, 'answered', queryId]
    );

    return res.json({ success: true, message: 'Reply sent successfully.' });
  } catch (error) {
    console.error('Failed to reply to query:', error.message || error);
    return res.status(500).json({ error: 'Failed to send reply. Please try again.' });
  }
};

exports.markQueryAsRead = async (req, res) => {
  const queryId = req.params.id;

  try {
    const [rows] = await pool.execute('SELECT status FROM user_queries WHERE id = ?', [queryId]);
    if (!rows.length) {
      return res.status(404).json({ error: 'Query not found.' });
    }

    if (rows[0].status === 'new') {
      await pool.execute(
        "UPDATE user_queries SET status = 'read' WHERE id = ?",
        [queryId]
      );
    }

    return res.json({ success: true, message: 'Query marked as read.' });
  } catch (error) {
    console.error('Failed to mark query as read:', error.message || error);
    return res.status(500).json({ error: 'Failed to mark query as read.' });
  }
};

exports.deleteQuery = async (req, res) => {
  const queryId = req.params.id;
  const userEmail = req.user?.email;
  const userRole = req.user?.role;

  if (!userEmail) {
    return res.status(401).json({ error: 'Unauthorized.' });
  }

  try {
    const [rows] = await pool.execute('SELECT user_email FROM user_queries WHERE id = ?', [queryId]);
    if (!rows.length) {
      return res.status(404).json({ error: 'Query not found.' });
    }

    const query = rows[0];

    if (userRole === 'admin') {
      await pool.execute('UPDATE user_queries SET deleted_by_admin = 1 WHERE id = ?', [queryId]);
    } else {
      if (query.user_email !== userEmail) {
        return res.status(403).json({ error: 'You are not authorized to delete this query.' });
      }
      await pool.execute('UPDATE user_queries SET deleted_by_user = 1 WHERE id = ?', [queryId]);
    }

    await pool.execute('DELETE FROM user_queries WHERE deleted_by_user = 1 AND deleted_by_admin = 1');

    return res.json({ success: true, message: 'Query deleted successfully.' });
  } catch (error) {
    console.error('Failed to delete query:', error.message || error);
    return res.status(500).json({ error: 'Failed to delete query.' });
  }
};

exports.clearMyHistory = async (req, res) => {
  const userEmail = req.user?.email;

  if (!userEmail) {
    return res.status(401).json({ error: 'Unauthorized.' });
  }

  try {
    await pool.execute('UPDATE user_queries SET deleted_by_user = 1 WHERE user_email = ?', [userEmail]);
    await pool.execute('DELETE FROM user_queries WHERE deleted_by_user = 1 AND deleted_by_admin = 1');
    return res.json({ success: true, message: 'Your support history has been cleared.' });
  } catch (error) {
    console.error('Failed to clear queries history:', error.message || error);
    return res.status(500).json({ error: 'Failed to clear query history.' });
  }
};

exports.clearAllHistory = async (req, res) => {
  try {
    await pool.execute('UPDATE user_queries SET deleted_by_admin = 1');
    await pool.execute('DELETE FROM user_queries WHERE deleted_by_user = 1 AND deleted_by_admin = 1');
    return res.json({ success: true, message: 'All support queries have been cleared from admin view.' });
  } catch (error) {
    console.error('Failed to clear all queries:', error.message || error);
    return res.status(500).json({ error: 'Failed to clear all queries.' });
  }
};
