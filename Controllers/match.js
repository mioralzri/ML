// ── routes/match.js ──────────────────────────────────────────────────
const router = require('express').Router();
const User   = require('../Models/User');
const auth   = require('../middleware/auth');

// POST /api/match/results  — called by game server after match ends
router.post('/results', auth, async (req, res) => {
  try {
    const { roomId, scores } = req.body;
    if (!scores || !Array.isArray(scores))
      return res.status(400).json({ success: false, message: 'Invalid scores data.' });

    const updates = scores.map(async (s) => {
      const user = await User.findById(s.userId);
      if (!user) return;

      user.points  += s.pointsEarned || 0;
      user.kills   += s.kills   || 0;
      user.deaths  += s.deaths  || 0;

      // Determine win (pointsEarned > pointsPerKill * kills means they got win bonus)
      if (s.pointsEarned >= 100) user.wins   += 1;
      else                       user.losses += 1;

      user.updateRank();
      await user.save();
    });

    await Promise.all(updates);
    res.json({ success: true, message: 'Results recorded.' });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

module.exports = router;
