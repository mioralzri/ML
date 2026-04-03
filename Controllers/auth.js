const router = require('express').Router();
const jwt    = require('jsonwebtoken');
const User   = require('../Models/User');

const makeToken = (id) =>
  jwt.sign({ id }, process.env.JWT_SECRET, { expiresIn: '7d' });

const sanitizeUser = (user) => ({
  id:       user._id,
  username: user.username,
  email:    user.email,
  points:   user.points,
  wins:     user.wins,
  losses:   user.losses,
  rank:     user.rank
});

// POST /api/auth/register
router.post('/register', async (req, res) => {
  try {
    const { username, email, password } = req.body;
    if (!username || !email || !password)
      return res.status(400).json({ success: false, message: 'All fields required.' });

    if (await User.findOne({ $or: [{ email }, { username }] }))
      return res.status(409).json({ success: false, message: 'Email or username already taken.' });

    const user  = await new User({ username, email, password }).save();
    const token = makeToken(user._id);
    res.status(201).json({ success: true, token, user: sanitizeUser(user) });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// POST /api/auth/login
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    const user = await User.findOne({ email });
    if (!user || !(await user.comparePassword(password)))
      return res.status(401).json({ success: false, message: 'Invalid email or password.' });

    const token = makeToken(user._id);
    res.json({ success: true, token, user: sanitizeUser(user) });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

module.exports = router;
