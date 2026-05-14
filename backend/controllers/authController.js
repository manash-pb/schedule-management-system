const pool = require('../db');
const { oauth2Client, generateMeetLink } = require('../googleCalendar');
const { google } = require('googleapis');
const bcrypt = require('bcrypt');
require('dotenv').config();

const SALT_ROUNDS = 10;

exports.googleCallback = async (req, res) => {
    try {
        const { tokens } = await oauth2Client.getToken(req.query.code);
        const intendedRole = req.query.state || 'user';

        oauth2Client.setCredentials(tokens);
        const oauth2 = google.oauth2({ version: 'v2', auth: oauth2Client });
        const userInfo = await oauth2.userinfo.get();

        const email = userInfo.data.email.toLowerCase();
        const name  = userInfo.data.name;
        const picture = userInfo.data.picture; // Extracted correctly
        
        const [rows] = await pool.execute('SELECT * FROM users WHERE email = ?', [email]);
        let user = rows[0];

        // Admin used user login but already has tokens — log in as admin directly
        if (user && user.role === 'admin' && intendedRole !== 'admin') {
            if (user.google_tokens) {
                // 1. ADDED PICTURE TO REDIRECT
                return res.redirect(`http://localhost:5173/?login=success&role=admin&email=${encodeURIComponent(email)}&name=${encodeURIComponent(name)}&picture=${encodeURIComponent(picture)}`);
            } else {
                return res.redirect('/auth/google?role=admin');
            }
        }

        if (user) {
            if (user.role === 'admin') {
                // 2. SAVE PICTURE FOR EXISTING ADMIN
                await pool.execute('UPDATE users SET google_tokens = ?, profile_picture = ? WHERE email = ?', [JSON.stringify(tokens), picture, email]);
                console.log(`✅ Updated admin tokens and picture for: ${email}`);
            } else {
                // 3. SAVE PICTURE FOR EXISTING USER
                await pool.execute('UPDATE users SET profile_picture = ? WHERE email = ?', [picture, email]);
            }
        } else {
            // 4. INSERT PICTURE FOR NEW USER
            const tokenString = intendedRole === 'admin' ? JSON.stringify(tokens) : null;
            await pool.execute(
                'INSERT INTO users (name, email, google_tokens, role, profile_picture) VALUES (?, ?, ?, ?, ?)',
                [name, email, tokenString, intendedRole, picture]
            );
            const [newRows] = await pool.execute('SELECT role FROM users WHERE email = ?', [email]);
            user = newRows[0];
        }

        const finalRole = user ? user.role : intendedRole;
        const redirectBase = 'http://localhost:5173/';
        
        // 5. ADDED PICTURE TO FINAL REDIRECT
        res.redirect(`${redirectBase}?login=success&role=${finalRole}&email=${encodeURIComponent(email)}&name=${encodeURIComponent(name)}&picture=${encodeURIComponent(picture)}`);

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

    const normalizedEmail = email.toLowerCase().trim();
    try {
        const [rows] = await pool.execute('SELECT * FROM users WHERE email = ?', [normalizedEmail]);
        const user = rows[0];
        if (!user) return res.status(401).json({ success: false, message: 'Invalid email or password' });

        // Google-only accounts have no password
        if (!user.password) return res.status(401).json({ success: false, message: 'This account uses Google sign-in. Please login with Google.' });

        const match = await bcrypt.compare(password, user.password);
        if (!match) return res.status(401).json({ success: false, message: 'Invalid email or password' });

        res.json({ success: true, role: user.role, name: user.name, email: user.email });
    } catch (error) {
        console.error('Login error:', error);
        res.status(500).json({ success: false, message: 'Server error' });
    }
};

exports.signup = async (req, res) => {
    const { name, email, password } = req.body;
    if (!name || !email || !password) return res.status(400).json({ success: false, message: 'All fields are required' });

    const normalizedEmail = email.toLowerCase().trim();
    try {
        const [existing] = await pool.execute('SELECT * FROM users WHERE email = ?', [normalizedEmail]);
        if (existing.length) return res.status(400).json({ success: false, message: 'User already exists' });

        const hashed = await bcrypt.hash(password, SALT_ROUNDS);
        await pool.execute(
            'INSERT INTO users (name, email, password, role) VALUES (?, ?, ?, ?)',
            [name, normalizedEmail, hashed, 'user']
        );
        res.json({ success: true, role: 'user', name, email: normalizedEmail });
    } catch (error) {
        console.error('Signup error:', error);
        res.status(500).json({ success: false });
    }
};

exports.updateProfile = async (req, res) => {
    const { email, name, currentPassword, newPassword } = req.body;
    if (!email) return res.status(400).json({ success: false, message: 'Email required' });

    const normalizedEmail = email.toLowerCase().trim();
    try {
        const [rows] = await pool.execute('SELECT * FROM users WHERE email = ?', [normalizedEmail]);
        if (!rows.length) return res.status(404).json({ success: false, message: 'User not found' });
        const user = rows[0];
        if (newPassword) {
            if (!user.password) return res.status(401).json({ success: false, message: 'No password set for this account' });
            const match = await bcrypt.compare(currentPassword, user.password);
            if (!match) return res.status(401).json({ success: false, message: 'Current password is incorrect' });
            const hashed = await bcrypt.hash(newPassword, SALT_ROUNDS);
            await pool.execute('UPDATE users SET name = ?, password = ? WHERE email = ?', [name || user.name, hashed, normalizedEmail]);
        } else {
            await pool.execute('UPDATE users SET name = ? WHERE email = ?', [name || user.name, normalizedEmail]);
        }
        res.json({ success: true, name: name || user.name });
    } catch (error) {
        console.error('Profile update error:', error);
        res.status(500).json({ success: false, message: 'Server error' });
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

exports.generateMeet = async (req, res) => {
    const { email } = req.body;
    if (!email) return res.status(400).json({ error: 'Email required' });
    try {
        const [rows] = await pool.execute('SELECT google_tokens FROM users WHERE email = ? AND role = "admin"', [email.toLowerCase()]);
        if (!rows.length || !rows[0].google_tokens) return res.status(403).json({ error: 'Google Calendar not connected' });
        const raw = rows[0].google_tokens;
        const tokens = typeof raw === 'string' ? JSON.parse(raw) : raw;
        const meetLink = await generateMeetLink(tokens);
        if (!meetLink) return res.status(500).json({ error: 'Failed to get Meet link' });
        res.json({ meetLink });
    } catch (e) {
        console.error('generateMeet error:', e);
        res.status(500).json({ error: 'Failed to generate Meet link' });
    }
};
