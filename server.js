require("dotenv").config();
const express = require("express");
const path = require("path");

const app = express();
const PORT = process.env.PORT || 3000;

// Serve static files from the public folder
app.use(express.static(path.join(__dirname, "public")));

// ── Spotify Auth ──────────────────────────────────────────────
// We use the Client Credentials flow (no user login needed).
// The token is cached and refreshed automatically.
let spotifyToken = null;
let tokenExpiresAt = 0;

async function getSpotifyToken() {
  if (spotifyToken && Date.now() < tokenExpiresAt) return spotifyToken;

  const clientId = process.env.SPOTIFY_CLIENT_ID;
  const clientSecret = process.env.SPOTIFY_CLIENT_SECRET;

  if (!clientId || !clientSecret) {
    throw new Error(
      "Missing SPOTIFY_CLIENT_ID or SPOTIFY_CLIENT_SECRET in .env file"
    );
  }

  const response = await fetch("https://accounts.spotify.com/api/token", {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      Authorization:
        "Basic " + Buffer.from(clientId + ":" + clientSecret).toString("base64"),
    },
    body: "grant_type=client_credentials",
  });

  if (!response.ok) {
    throw new Error("Failed to get Spotify token");
  }

  const data = await response.json();
  spotifyToken = data.access_token;
  // Refresh 60 seconds early to be safe
  tokenExpiresAt = Date.now() + (data.expires_in - 60) * 1000;
  return spotifyToken;
}

// ── API: Search for a song ────────────────────────────────────
app.get("/api/search", async (req, res) => {
  const query = req.query.q;
  if (!query) return res.status(400).json({ error: "Missing search query" });

  try {
    const token = await getSpotifyToken();
    const url = `https://api.spotify.com/v1/search?q=${encodeURIComponent(query)}&type=track&limit=5`;
    const response = await fetch(url, {
      headers: { Authorization: `Bearer ${token}` },
    });
    const data = await response.json();

    const tracks = (data.tracks?.items || []).map((track) => ({
      id: track.id,
      name: track.name,
      artist: track.artists.map((a) => a.name).join(", "),
      album: track.album.name,
      image: track.album.images[0]?.url || "",
      spotifyUrl: track.external_urls.spotify,
    }));

    res.json(tracks);
  } catch (err) {
    console.error("Search error:", err.message);
    res.status(500).json({ error: err.message });
  }
});

// ── API: Get 10 recommendations based on a seed track ─────────
app.get("/api/recommendations", async (req, res) => {
  const trackId = req.query.trackId;
  if (!trackId) return res.status(400).json({ error: "Missing trackId" });

  try {
    const token = await getSpotifyToken();
    const url = `https://api.spotify.com/v1/recommendations?seed_tracks=${encodeURIComponent(trackId)}&limit=10`;
    const response = await fetch(url, {
      headers: { Authorization: `Bearer ${token}` },
    });
    const data = await response.json();

    const tracks = (data.tracks || []).map((track) => ({
      id: track.id,
      name: track.name,
      artist: track.artists.map((a) => a.name).join(", "),
      album: track.album.name,
      image: track.album.images[0]?.url || "",
      spotifyUrl: track.external_urls.spotify,
      previewUrl: track.preview_url,
    }));

    res.json(tracks);
  } catch (err) {
    console.error("Recommendations error:", err.message);
    res.status(500).json({ error: err.message });
  }
});

app.listen(PORT, () => {
  console.log(`✨ Song recommender running at http://localhost:${PORT}`);
});
