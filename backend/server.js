require('dotenv').config();
const express = require('express');
const cors = require('cors');
const pool = require('./db');
const { startCronJobs } = require('./cronJobs');

const eventRoutes = require('./routes/events');
const authRoutes  = require('./routes/auth');

const app = express();
app.use(cors());
app.use(express.json());

// Verify DB connection on startup
pool.getConnection()
    .then(conn => { console.log('✅ Connected to MySQL Database!'); conn.release(); })
    .catch(err  => console.error('❌ Database connection error:', err));

// Start cron jobs
startCronJobs();

// Mount routes
app.use('/api/events', eventRoutes);
app.use('/auth',       authRoutes);
app.use('/api/auth',   authRoutes);

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
