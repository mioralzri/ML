const router  = require('express').Router();
const Room    = require('../Models/Room');
const User    = require('../Models/User');
const auth    = require('../middleware/auth');

// GET /api/rooms/public
router.get('/public', auth, async (req, res) => {
  try {
    const page  = Math.max(1, parseInt(req.query.page) || 1);
    const limit = Math.min(50, parseInt(req.query.limit) || 20);
    const skip  = (page - 1) * limit;

    const [rooms, total] = await Promise.all([
      Room.find({ visibility: 'public', status: 'waiting' })
          .sort({ createdAt: -1 }).skip(skip).limit(limit),
      Room.countDocuments({ visibility: 'public', status: 'waiting' })
    ]);

    res.json({ success: true, rooms, total });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// POST /api/rooms/create
router.post('/create', auth, async (req, res) => {
  try {
    const { name, visibility, maxPlayers, gameMode, mapId } = req.body;
    const user = await User.findById(req.userId);

    // Remove user from any existing room first
    await Room.updateMany({ 'players.userId': req.userId }, {
      $pull: { players: { userId: req.userId } }
    });

    const room = await new Room({
      name: name || `${user.username}'s Room`,
      visibility: visibility || 'public',
      maxPlayers: Math.min(10, Math.max(2, maxPlayers || 10)),
      gameMode: gameMode || 'classic',
      mapId: mapId || 'forest_map',
      hostId: user._id,
      hostUsername: user.username,
      players: [{
        userId: user._id, username: user.username,
        points: user.points, rank: user.rank,
        team: 'blue', isReady: false, isHost: true
      }]
    }).save();

    res.json({ success: true, room });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// POST /api/rooms/join  — accepts roomId (ObjectId) or roomCode (6-char)
router.post('/join', auth, async (req, res) => {
  try {
    const { roomIdOrCode } = req.body;
    const user = await User.findById(req.userId);

    const query = roomIdOrCode.length === 6
      ? { roomCode: roomIdOrCode.toUpperCase() }
      : { _id: roomIdOrCode };

    const room = await Room.findOne(query);
    if (!room) return res.status(404).json({ success: false, message: 'Room not found.' });
    if (room.status !== 'waiting') return res.status(400).json({ success: false, message: 'Room already started.' });
    if (room.players.length >= room.maxPlayers)
      return res.status(400).json({ success: false, message: 'Room is full.' });
    if (room.players.some(p => p.userId.toString() === req.userId))
      return res.status(400).json({ success: false, message: 'You are already in this room.' });

    // Auto-balance teams
    const blueCount = room.players.filter(p => p.team === 'blue').length;
    const redCount  = room.players.filter(p => p.team === 'red').length;
    const team = blueCount <= redCount ? 'blue' : 'red';

    room.players.push({
      userId: user._id, username: user.username,
      points: user.points, rank: user.rank,
      team, isReady: false, isHost: false
    });
    await room.save();
    res.json({ success: true, room });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// POST /api/rooms/ready
router.post('/ready', auth, async (req, res) => {
  try {
    const { roomId, isReady } = req.body;
    const room = await Room.findById(roomId);
    if (!room) return res.status(404).json({ success: false, message: 'Room not found.' });

    const player = room.players.find(p => p.userId.toString() === req.userId);
    if (!player) return res.status(400).json({ success: false, message: 'You are not in this room.' });

    player.isReady = isReady;
    await room.save();
    res.json({ success: true, room });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// POST /api/rooms/start  — host only; allocates Hathora server
router.post('/start', auth, async (req, res) => {
  try {
    const { roomId } = req.body;
    const room = await Room.findById(roomId);
    if (!room) return res.status(404).json({ success: false, message: 'Room not found.' });
    if (room.hostId.toString() !== req.userId)
      return res.status(403).json({ success: false, message: 'Only the host can start.' });

    const nonHostReady = room.players.filter(p => !p.isHost).every(p => p.isReady);
    if (!nonHostReady)
      return res.status(400).json({ success: false, message: 'Not all players are ready.' });

    // --- Allocate Hathora process ---
    const hathoraRes = await fetch(
      `https://api.hathora.dev/rooms/v2/${process.env.HATHORA_APP_ID}/create`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${process.env.HATHORA_DEV_TOKEN}`
        },
        body: JSON.stringify({
          region: 'Singapore',
          roomConfig: JSON.stringify({ internalRoomId: room._id.toString(), maxPlayers: room.maxPlayers })
        })
      }
    );

    const hathoraData = await hathoraRes.json();
    room.hathoraRoomId = hathoraData.roomId;
    room.status = 'ingame';
    await room.save();

    res.json({ success: true, room });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// POST /api/rooms/leave
router.post('/leave', auth, async (req, res) => {
  try {
    const { roomId } = req.body;
    const room = await Room.findById(roomId);
    if (!room) return res.json({ success: true }); // Already gone

    const wasHost = room.hostId.toString() === req.userId;
    room.players = room.players.filter(p => p.userId.toString() !== req.userId);

    if (room.players.length === 0) {
      await room.deleteOne();
    } else if (wasHost) {
      // Promote next player to host
      room.players[0].isHost = true;
      room.hostId = room.players[0].userId;
      room.hostUsername = room.players[0].username;
      await room.save();
    } else {
      await room.save();
    }

    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

module.exports = router;
