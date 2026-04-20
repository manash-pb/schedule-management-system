const pool = require('../db');
const { oauth2Client } = require('../googleCalendar');
const { google } = require('googleapis');
require('dotenv').config();

exports.googleCallback = async (req, res) => {
    try {
        const { tokens } = await oauth2Client.getToken(req.query.code);
        const intendedRole = req.query.state || 'user';

        oauth2Client.setCredentials(tokens);
        const oauth2 = google.oauth2({ version: 'v2', auth: oauth2Client });
        const userInfo = await oauth2.userinfo.get();

        const email = userInfo.data.email.toLowerCase();
        const name  = userInfo.data.name;

        const [rows] = await pool.execute('SELECT * FROM users WHERE email = ?', [email]);
        let user = rows[0];

        // Admin used user login but already has tokens — log in as admin directly
        if (user && user.role === 'admin' && intendedRole !== 'admin') {
            if (user.google_tokens) {
                return res.redirect(`http://localhost:5173/?login=success&role=admin&email=${encodeURIComponent(email)}&name=${encodeURIComponent(name)}`);
            } else {
                return res.redirect('/auth/google?role=admin');
            }
        }

        if (user) {
            if (user.role === 'admin' && tokens.refresh_token) {
                await pool.execute('UPDATE users SET google_tokens = ? WHERE email = ?', [JSON.stringify(tokens), email]);
                console.log(`✅ Updated admin tokens for: ${email}`);
            }
        } else {
            const tokenString = intendedRole === 'admin' ? JSON.stringify(tokens) : null;
            await pool.execute(
                'INSERT INTO users (name, email, google_tokens, role) VALUES (?, ?, ?, ?)',
                [name, email, tokenString, intendedRole]
            );
            const [newRows] = await pool.execute('SELECT role FROM users WHERE email = ?', [email]);
            user = newRows[0];
        }

        const finalRole = user ? user.role : intendedRole;
        const alreadyHadTokens = user && user.google_tokens;
        const redirectBase = (finalRole === 'admin' && alreadyHadTokens)
            ? 'http://localhost:5173/admin-dashboard'
            : 'http://localhost:5173/';
        res.redirect(`${redirectBase}?login=success&role=${finalRole}&email=${encodeURIComponent(email)}&name=${encodeURIComponent(name)}`);

    } catch (error) {
        console.error('Google auth error:', error);
        res.status(500).send('Authentication failed');
    }
};

exports.googleAuthRedirect = (req, res) => {
    const requestedRole = req.query.role || 'user';
    const scopes = [
        'https://www.googleapis.com/auth/userinfo.profile',
        'https://www.googleapis.com/auth/userinfo.email',
    ];
    if (requestedRole === 'admin') scopes.push('https://www.googleapis.com/auth/calendar');

    const url = oauth2Client.generateAuthUrl({
        access_type: 'offline',
        scope: scopes,
        prompt: 'consent',
        state: requestedRole,
    });
    res.redirect(url);
};

exports.manualLogin = async (req, res) => {
    const { email, password } = req.body;
    if (!email || !password) return res.status(400).json({ success: false, message: 'Email and password are required' });

    try {
        const [rows] = await pool.execute('SELECT * FROM users WHERE email = ?', [email.toLowerCase()]);
        const user = rows[0];
        if (user && user.password === password) {
            return res.json({ success: true, role: user.role, name: user.name, email: user.email });
        }
        res.status(401).json({ success: false, message: 'Invalid email or password' });
    } catch (error) {
        console.error('Login error:', error);
        res.status(500).json({ success: false, message: 'Server error' });
    }
};

exports.signup = async (req, res) => {
    const { name, email, password } = req.body;
    if (!name || !email || !password) return res.status(400).json({ success: false, message: 'All fields are required' });

    try {
        const [existing] = await pool.execute('SELECT * FROM users WHERE email = ?', [email]);
        if (existing.length) return res.status(400).json({ success: false, message: 'User already exists' });

        await pool.execute(
            'INSERT INTO users (name, email, password, role) VALUES (?, ?, ?, ?)',
            [name, email.toLowerCase(), password, 'user']
        );
        res.json({ success: true, role: 'user', name, email: email.toLowerCase() });
    } catch (error) {
        console.error('Signup error:', error);
        res.status(500).json({ success: false });
    }
};

exports.checkCalendar = async (req, res) => {
    const { email } = req.query;
    if (!email) return res.json({ connected: false });
    try {
        const [rows] = await pool.execute('SELECT google_tokens FROM users WHERE email = ? AND role = "admin"', [email]);
        res.json({ connected: rows.length > 0 && !!rows[0].google_tokens });
    } catch {
        res.json({ connected: false });
    }
};
