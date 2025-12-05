const axios = require("axios");
const User = require("./models/User");

module.exports = async function getValidToken(airtableUserId) {
  const user = await User.findOne({ airtableUserId });
  if (!user) throw new Error("User not found");

  if (user.tokenExpiresAt && user.tokenExpiresAt > new Date()) {
    return user.accessToken;
  }

  if (!user.refreshToken) throw new Error("No refresh token available");

  const params = new URLSearchParams({
    grant_type: "refresh_token",
    refresh_token: user.refreshToken,
    client_id: process.env.AIRTABLE_CLIENT_ID,
    client_secret: process.env.AIRTABLE_CLIENT_SECRET,
  });

  const resp = await axios.post(
    "https://airtable.com/oauth2/v1/token",
    params.toString(),
    { headers: { "Content-Type": "application/x-www-form-urlencoded" } }
  );

  user.accessToken = resp.data.access_token;
  user.refreshToken = resp.data.refresh_token || user.refreshToken;
  user.tokenExpiresAt = new Date(Date.now() + resp.data.expires_in * 1000);

  await user.save();

  return user.accessToken;
};
