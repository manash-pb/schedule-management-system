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
       WHERE user_email = ?
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
  const { reply } = req.body;
  const adminEmail = req.user?.email;
  const adminName = req.user?.name || adminEmail || 'Admin';

  if (!reply || !reply.trim()) {
    return res.status(400).json({ error: 'Reply message cannot be empty.' });
  }

  try {
    const [rows] = await pool.execute('SELECT user_email, user_name, subject, message FROM user_queries WHERE id = ?', [queryId]);
    if (!rows.length) {
      return res.status(404).json({ error: 'Query not found.' });
    }

    const query = rows[0];
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
