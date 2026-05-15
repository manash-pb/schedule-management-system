const pool = require('../db');
const { oauth2Client, generateMeetLink } = require('../googleCalendar');
const { google } = require('googleapis');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
require('dotenv').config();

const SALT_ROUNDS = 10;
const cookieOptions = {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'lax',
    path: '/',
    maxAge: 7 * 24 * 60 * 60 * 1000,
};

exports.googleCallback = async (req, res) => {
    try {
        const { tokens } = await oauth2Client.getToken(req.query.code);
        const [intendedRole, rememberPref] = (req.query.state || 'user:0').split(':');

        oauth2Client.setCredentials(tokens);
        const oauth2 = google.oauth2({ version: 'v2', auth: oauth2Client });
        const userInfo = await oauth2.userinfo.get();

        const email = userInfo.data.email.toLowerCase();
        const name  = userInfo.data.name;
        const googlePic = userInfo.data.picture; // The fresh pic from Google
        
        const [rows] = await pool.execute('SELECT * FROM users WHERE email = ?', [email]);
        let user = rows[0];

        // --- THE FIX: Determine which picture to use and whether to update the DB ---
        let finalPicture = googlePic; 

        if (user) {
            // Check if the current DB picture is a custom upload (contains '/uploads/')
            const hasCustomPhoto = user.profile_picture && user.profile_picture.includes('/uploads/');
            
            if (hasCustomPhoto) {
                // Keep the custom one!
                finalPicture = user.profile_picture;
            }

            // Handle the redirect for Admin who used user login path
            if (user.role === 'admin' && intendedRole !== 'admin') {
                if (user.google_tokens) {
                    const earlyToken = jwt.sign(
                        { email, role: 'admin' },
                        process.env.JWT_SECRET,
                        { expiresIn: '7d' }
                    );
                    res.cookie('authToken', earlyToken, cookieOptions);
                    return res.redirect(`http://localhost:5173/?login=success&role=admin&token=${earlyToken}&email=${encodeURIComponent(email)}&name=${encodeURIComponent(name)}&picture=${encodeURIComponent(finalPicture)}`);
                } else {
                    return res.redirect('/auth/google?role=admin');
                }
            }

            // Update user/admin info, but DON'T overwrite the picture if it's custom
            if (user.role === 'admin') {
                // If they have a custom photo, we only update the tokens. If not, update tokens AND picture.
                if (hasCustomPhoto) {
                    await pool.execute('UPDATE users SET google_tokens = ? WHERE email = ?', [JSON.stringify(tokens), email]);
                } else {
                    await pool.execute('UPDATE users SET google_tokens = ?, profile_picture = ? WHERE email = ?', [JSON.stringify(tokens), googlePic, email]);
                }
            } else {
                // For standard users, only update if they don't have a custom photo
                if (!hasCustomPhoto) {
                    await pool.execute('UPDATE users SET profile_picture = ? WHERE email = ?', [googlePic, email]);
                }
            }
        } else {
            // New User: INSERT the Google pic
            const tokenString = intendedRole === 'admin' ? JSON.stringify(tokens) : null;
            await pool.execute(
                'INSERT INTO users (name, email, google_tokens, role, profile_picture) VALUES (?, ?, ?, ?, ?)',
                [name, email, tokenString, intendedRole, googlePic]
            );
            finalPicture = googlePic;
            // Re-fetch to get the role if needed, or just use intendedRole
            const [newRows] = await pool.execute('SELECT role FROM users WHERE email = ?', [email]);
            user = newRows[0];
        }

        const finalRole = user ? user.role : intendedRole;

        const googleToken = jwt.sign(
            { email, role: finalRole },
            process.env.JWT_SECRET,
            { expiresIn: '7d' }
        );

        res.cookie('authToken', googleToken, cookieOptions);

        const redirectBase = 'http://localhost:5173/';

        if (finalPicture === 'https://lh3.googleusercontent.com/a/default-user' || finalPicture?.endsWith('/picture/0')) {
            finalPicture = 'null';
        }

        res.redirect(`${redirectBase}?login=success&role=${finalRole}&token=${googleToken}&email=${encodeURIComponent(email)}&name=${encodeURIComponent(name)}&picture=${encodeURIComponent(finalPicture)}&remember=${rememberPref}`);

    } catch (error) {
        console.error('Google auth error:', error);
        res.status(500).send('Authentication failed');
    }
};

exports.googleAuthRedirect = (req, res) => {
    const requestedRole = req.query.role || 'user';
    const remember = req.query.remember === 'true' ? '1' : '0';
    const scopes = [
        'https://www.googleapis.com/auth/userinfo.profile',
        'https://www.googleapis.com/auth/userinfo.email',
    ];
    if (requestedRole === 'admin') scopes.push('https://www.googleapis.com/auth/calendar');

    const url = oauth2Client.generateAuthUrl({
        access_type: 'offline',
        scope: scopes,
        prompt: 'consent',
        state: `${requestedRole}:${remember}`,
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

        const googleDefault = 'https://lh3.googleusercontent.com/a/ACg8ocJRX7drijwDmOsxeFUZUUZUyqf9EIDS6vUzkGM_DjKOOfjkCQ=s96-c';
        const cleanPic = (user.profile_picture === googleDefault) ? null : user.profile_picture;

        const token = jwt.sign(
            { email: user.email, role: user.role },
            process.env.JWT_SECRET,
            { expiresIn: '7d' }
        );

        res.cookie('authToken', token, cookieOptions);

        res.json({ success: true, role: user.role, name: user.name, email: user.email, profile_picture: cleanPic, token });
        
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
        
        // The SQL INSERT remains the same as the DB column defaults to NULL
        await pool.execute(
            'INSERT INTO users (name, email, password, role) VALUES (?, ?, ?, ?)',
            [name, normalizedEmail, hashed, 'user']
        );

        const token = jwt.sign(
            { email: normalizedEmail, role: 'user' },
            process.env.JWT_SECRET,
            { expiresIn: '7d' }
        );

        res.cookie('authToken', token, cookieOptions);

        // --- UPDATED RESPONSE: Explicitly sending profile_picture: null ---
        res.json({ 
            success: true, 
            role: 'user', 
            name, 
            email: normalizedEmail,
            profile_picture: null,
            token
        });
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

exports.logout = (req, res) => {
    res.clearCookie('authToken', {
        ...cookieOptions,
        maxAge: 0,
    });
    res.json({ success: true });
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
