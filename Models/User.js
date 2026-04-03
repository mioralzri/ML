const mongoose = require('mongoose');
const bcrypt   = require('bcryptjs');

const UserSchema = new mongoose.Schema({
  username: { type: String, required: true, unique: true, trim: true, minlength: 3, maxlength: 20 },
  email:    { type: String, required: true, unique: true, lowercase: true },
  password: { type: String, required: true },
  points:   { type: Number, default: 0 },
  wins:     { type: Number, default: 0 },
  losses:   { type: Number, default: 0 },
  kills:    { type: Number, default: 0 },
  deaths:   { type: Number, default: 0 },
  rank: {
    type: String,
    enum: ['Bronze', 'Silver', 'Gold', 'Platinum', 'Diamond', 'Master'],
    default: 'Bronze'
  },
  createdAt: { type: Date, default: Date.now }
});

// Hash password before save
UserSchema.pre('save', async function (next) {
  if (!this.isModified('password')) return next();
  this.password = await bcrypt.hash(this.password, 12);
  next();
});

UserSchema.methods.comparePassword = function (plain) {
  return bcrypt.compare(plain, this.password);
};

// Auto-rank based on points
UserSchema.methods.updateRank = function () {
  if      (this.points >= 5000) this.rank = 'Master';
  else if (this.points >= 2000) this.rank = 'Diamond';
  else if (this.points >= 1000) this.rank = 'Platinum';
  else if (this.points >= 500)  this.rank = 'Gold';
  else if (this.points >= 200)  this.rank = 'Silver';
  else                          this.rank = 'Bronze';
};

module.exports = mongoose.model('User', UserSchema);
