require("dotenv").config();
const express = require("express");
const path = require("path");

const app = express();
const PORT = process.env.PORT || 3000;

const LASTFM_BASE = "https://ws.audioscrobbler.com/2.0/";

// Serve static files from the public folder
app.use(express.static(path.join(__dirname, "public")));

function getApiKey() {
  const key = process.env.LASTFM_API_KEY;
  if (!key) throw new Error("Missing LASTFM_API_KEY in .env file");
  return key;
}

// Helper: pick the largest available image from Last.fm's image array
function pickImage(images) {
  if (!images || !Array.isArray(images)) return "";
  // Last.fm returns sizes: small, medium, large, extralarge
  for (let i = images.length - 1; i >= 0; i--) {
    if (images[i]["#text"]) return images[i]["#text"];
  }
  return "";
}

// ── API: Search for a song ────────────────────────────────────
app.get("/api/search", async (req, res) => {
  const query = req.query.q;
  if (!query) return res.status(400).json({ error: "Missing search query" });

  try {
    const apiKey = getApiKey();
    const url = `${LASTFM_BASE}?method=track.search&track=${encodeURIComponent(query)}&api_key=${encodeURIComponent(apiKey)}&format=json&limit=5`;
    const response = await fetch(url);
    const data = await response.json();

    if (data.error) {
      return res.status(400).json({ error: data.message || "Last.fm error" });
    }

    const matches = data.results?.trackmatches?.track || [];
    const tracks = matches.map((track) => ({
      name: track.name,
      artist: track.artist,
      image: pickImage(track.image),
      lastfmUrl: track.url,
    }));

    res.json(tracks);
  } catch (err) {
    console.error("Search error:", err.message);
    res.status(500).json({ error: err.message });
  }
});

// ── API: Get 10 similar songs based on a track ────────────────
app.get("/api/recommendations", async (req, res) => {
  const track = req.query.track;
  const artist = req.query.artist;
  if (!track || !artist) {
    return res.status(400).json({ error: "Missing track or artist" });
  }

  try {
    const apiKey = getApiKey();
    const url = `${LASTFM_BASE}?method=track.getSimilar&track=${encodeURIComponent(track)}&artist=${encodeURIComponent(artist)}&api_key=${encodeURIComponent(apiKey)}&format=json&limit=10&autocorrect=1`;
    const response = await fetch(url);
    const data = await response.json();

    if (data.error) {
      return res.status(400).json({ error: data.message || "Last.fm error" });
    }

    const similar = data.similartracks?.track || [];
    const tracks = similar.map((t) => ({
      name: t.name,
      artist: t.artist?.name || "",
      image: pickImage(t.image),
      lastfmUrl: t.url,
      // Build a Spotify search link so the user can find the song on Spotify
      spotifyUrl: `https://open.spotify.com/search/${encodeURIComponent(t.name + " " + (t.artist?.name || ""))}`,
      match: t.match,
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
