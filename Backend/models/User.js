const mongoose = require("mongoose");

const UserSchema = new mongoose.Schema({
  airtableUserId: { type: String, required: true, unique: true },
  accessToken: String,
  refreshToken: String,
  tokenExpiresAt: Date,
  lastLoginAt: { type: Date, default: Date.now },
});

module.exports = mongoose.model("User", UserSchema);
