const mongoose = require('mongoose');
const { customAlphabet } = require('nanoid');
const nanoid = customAlphabet('ABCDEFGHJKLMNPQRSTUVWXYZ23456789', 6);

const RoomPlayerSchema = new mongoose.Schema({
  userId:   { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  username: String,
  points:   Number,
  rank:     String,
  team:     { type: String, enum: ['blue', 'red'], default: 'blue' },
  isReady:  { type: Boolean, default: false },
  isHost:   { type: Boolean, default: false }
}, { _id: false });

const RoomSchema = new mongoose.Schema({
  name:           { type: String, required: true, maxlength: 40 },
  roomCode:       { type: String, unique: true },   // 6-char code
  hostId:         { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  hostUsername:   String,
  visibility:     { type: String, enum: ['public', 'private'], default: 'public' },
  status:         { type: String, enum: ['waiting', 'starting', 'ingame', 'closed'], default: 'waiting' },
  maxPlayers:     { type: Number, default: 10, min: 2, max: 10 },
  players:        [RoomPlayerSchema],
  gameMode:       { type: String, default: 'classic' },
  mapId:          { type: String, default: 'forest_map' },
  hathoraRoomId:  String,
  serverHost:     String,
  serverPort:     Number,
  createdAt:      { type: Date, default: Date.now, expires: '2h' } // Auto-delete after 2 hours
});

RoomSchema.virtual('currentPlayers').get(function () {
  return this.players.length;
});

RoomSchema.set('toJSON', { virtuals: true });

// Generate unique room code before save
RoomSchema.pre('save', async function (next) {
  if (!this.roomCode) {
    let code, exists;
    do {
      code = nanoid();
      exists = await mongoose.model('Room').findOne({ roomCode: code });
    } while (exists);
    this.roomCode = code;
  }
  next();
});

module.exports = mongoose.model('Room', RoomSchema);
