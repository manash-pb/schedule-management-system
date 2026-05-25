// ==========================================
// 1. Environment Variables & Built-in Modules
// ==========================================
require('dotenv').config();
const http = require('http');
const path = require('path');
const fs = require('fs');

// ==========================================
// 2. Third-Party Dependencies
// ==========================================
const express = require('express');
const cors = require('cors');
const compression = require('compression');
const cookieParser = require('cookie-parser');
const multer = require('multer');
const { Server } = require('socket.io');

// ==========================================
// 3. Local Imports
// ==========================================
const pool = require('./db');
const { startCronJobs } = require('./cronJobs');
const eventRoutes = require('./routes/events');
const authRoutes = require('./routes/auth');
const notificationRoutes = require('./routes/notifications');
const queryRoutes = require('./routes/queries');

// ==========================================
// 4. Express App & Middleware Initialization
// ==========================================
const app = express();

app.use(cors({
    origin: function (origin, callback) {
        callback(null, true);
    },
    methods: ['GET', 'POST', 'PATCH', 'DELETE', 'PUT'],
    credentials: true,
}));
app.use(compression());
app.use(express.json());
app.use(cookieParser());

// ==========================================
// 5. Database Connection & Schema Setup
// ==========================================
pool.getConnection()
    .then(async (conn) => {
        console.log('✅ Connected to MySQL Database!');
        conn.release();

        try {
            await pool.query(`
                CREATE TABLE IF NOT EXISTS user_queries (
                    id INT AUTO_INCREMENT PRIMARY KEY,
                    user_name VARCHAR(255),
                    user_email VARCHAR(255) NOT NULL,
                    subject VARCHAR(255),
                    message TEXT NOT NULL,
                    status ENUM('new','read','answered') DEFAULT 'new',
                    reply_message TEXT,
                    reply_at TIMESTAMP NULL,
                    replied_by VARCHAR(255),
                    deleted_by_user TINYINT(1) DEFAULT 0,
                    deleted_by_admin TINYINT(1) DEFAULT 0,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    INDEX (user_email),
                    FOREIGN KEY (user_email) REFERENCES users(email) ON DELETE CASCADE
                )
            `);
            console.log('✅ Ensured user_queries table exists.');

            // Alter existing table to support 'read' status if it doesn't already
            try {
                await pool.query(`
                    ALTER TABLE user_queries 
                    MODIFY COLUMN status ENUM('new','read','answered') DEFAULT 'new'
                `);
                console.log('✅ Ensured user_queries status ENUM supports "read".');
            } catch (alterErr) {
                console.warn('⚠️ Could not alter user_queries status ENUM:', alterErr.message);
            }

            // Ensure deleted_by_user column exists
            try {
                await pool.query(`
                    ALTER TABLE user_queries 
                    ADD COLUMN deleted_by_user TINYINT(1) DEFAULT 0
                `);
                console.log('✅ Ensured deleted_by_user column exists in user_queries.');
            } catch (err) {
                // Ignore if it already exists
            }

            // Ensure deleted_by_admin column exists
            try {
                await pool.query(`
                    ALTER TABLE user_queries 
                    ADD COLUMN deleted_by_admin TINYINT(1) DEFAULT 0
                `);
                console.log('✅ Ensured deleted_by_admin column exists in user_queries.');
            } catch (err) {
                // Ignore if it already exists
            }

        } catch (err) {
            console.error('❌ user_queries table creation failed:', err);
        }
    })
    .catch(err => console.error('❌ Database connection error:', err));

// ==========================================
// 6. Cron Jobs
// ==========================================
startCronJobs();

// ==========================================
// 7. Static Files & Multer Upload Config
// ==========================================
const uploadDir = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadDir)) {
    fs.mkdirSync(uploadDir);
}
app.use('/uploads', express.static(uploadDir));

const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        cb(null, 'uploads/');
    },
    filename: function (req, file, cb) {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        cb(null, 'profile-' + uniqueSuffix + path.extname(file.originalname));
    }
});
const upload = multer({ storage: storage });

// ==========================================
// 8. API Routes
// ==========================================
// User Upload Routes
app.post('/api/users/upload-pic', upload.single('profilePic'), async (req, res) => {
    try {
        const email = req.body.email;

        if (!req.file) {
            return res.status(400).json({ success: false, message: 'No file uploaded' });
        }

        // 1. FIND THE OLD IMAGE PATH BEFORE UPDATING
        const [rows] = await pool.execute('SELECT profile_picture FROM users WHERE email = ?', [email]);
        const oldImageUrl = rows[0]?.profile_picture;

        if (oldImageUrl && oldImageUrl.includes('/uploads/')) {
            // Extract the filename from the URL
            const filename = oldImageUrl.split('/').pop();
            const oldFilePath = path.join(__dirname, 'uploads', filename);

            // 2. DELETE THE OLD FILE FROM DISK
            fs.unlink(oldFilePath, (err) => {
                if (err) {
                    console.error("Could not delete old file:", err);
                } else {
                    console.log(`✅ Deleted old profile pic: ${filename}`);
                }
            });
        }

        // 3. GENERATE NEW URL AND UPDATE DB
        const imageUrl = `http://localhost:3000/uploads/${req.file.filename}`;
        await pool.execute('UPDATE users SET profile_picture = ? WHERE email = ?', [imageUrl, email]);

        res.json({ success: true, message: 'Profile picture updated', imageUrl });

    } catch (error) {
        console.error('Upload Error:', error);
        res.status(500).json({ success: false, message: 'Failed to upload image' });
    }
});

app.post('/api/users/delete-pic', async (req, res) => {
    try {
        const email = req.body.email;
        if (!email) {
            return res.status(400).json({ success: false, message: 'Email is required' });
        }

        const [rows] = await pool.execute('SELECT profile_picture FROM users WHERE email = ?', [email]);
        const profilePicture = rows[0]?.profile_picture;

        if (!profilePicture || profilePicture === 'null' || profilePicture === 'undefined') {
            return res.status(400).json({ success: false, message: 'No profile picture to delete' });
        }

        if (profilePicture.includes('/uploads/')) {
            const filename = profilePicture.split('/').pop();
            const filePath = path.join(__dirname, 'uploads', filename);
            if (fs.existsSync(filePath)) {
                fs.unlinkSync(filePath);
            }
        }

        await pool.execute('UPDATE users SET profile_picture = NULL WHERE email = ?', [email]);
        res.json({ success: true });
    } catch (error) {
        console.error('Delete profile pic error:', error);
        res.status(500).json({ success: false, message: 'Failed to delete profile picture' });
    }
});

// Main App Routes
app.use('/api/events', eventRoutes);
app.use('/auth', authRoutes);
app.use('/api/auth', authRoutes);
app.use('/api/notifications', notificationRoutes);
app.use('/api/queries', queryRoutes);

// ==========================================
// 9. Server & Socket.io Initialization
// ==========================================
const server = http.createServer(app);
const io = new Server(server, {
    cors: {
        origin: function (origin, callback) {
            callback(null, true);
        },
        credentials: true // Crucial: This allows our new HttpOnly cookies to pass!
    }
});

app.set('io', io);

io.on('connection', (socket) => {
    console.log('A user connected:', socket.id);

    socket.on('disconnect', () => {
        console.log('User disconnected:', socket.id);
    });
});

// ==========================================
// 10. Start Server
// ==========================================
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});