// ── routes/leaderboard.js ────────────────────────────────────────────
const router = require('express').Router();
const User   = require('../Models/User');
const auth   = require('../middleware/auth');

// GET /api/leaderboard?page=1&limit=20
router.get('/', auth, async (req, res) => {
  try {
    const page  = Math.max(1, parseInt(req.query.page) || 1);
    const limit = Math.min(100, parseInt(req.query.limit) || 20);
    const skip  = (page - 1) * limit;

    const [users, total] = await Promise.all([
      User.find({}, 'username points wins losses rank')
          .sort({ points: -1 }).skip(skip).limit(limit),
      User.countDocuments()
    ]);

    // Add position number
    const ranked = users.map((u, i) => ({
      position: skip + i + 1,
      username: u.username,
      points:   u.points,
      wins:     u.wins,
      losses:   u.losses,
      rank:     u.rank
    }));

    res.json({ success: true, leaderboard: ranked, total });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

module.exports = router;
