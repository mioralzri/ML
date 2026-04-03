const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const helmet = require('helmet');
require('dotenv').config();

const authRoutes  = require('./routes/auth');
const userRoutes  = require('./routes/user');
const roomRoutes  = require('./routes/room');
const matchRoutes = require('./routes/match');
const leaderboardRoutes = require('./routes/leaderboard');

const app = express();

// ── Middleware ────────────────────────────────────────────────────────
app.use(helmet());
app.use(cors());
app.use(express.json());

// ── DB Connection ─────────────────────────────────────────────────────
mongoose.connect(process.env.MONGO_URI)
  .then(() => console.log('MongoDB connected'))
  .catch(err => { console.error('MongoDB error:', err); process.exit(1); });

// ── Routes ────────────────────────────────────────────────────────────
app.use('/api/auth',        authRoutes);
app.use('/api/user',        userRoutes);
app.use('/api/rooms',       roomRoutes);
app.use('/api/match',       matchRoutes);
app.use('/api/leaderboard', leaderboardRoutes);

app.get('/health', (_, res) => res.json({ status: 'ok' }));

// ── Start ─────────────────────────────────────────────────────────────
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
