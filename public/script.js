// ── DOM Elements ──────────────────────────────────────────
const searchInput = document.getElementById("searchInput");
const searchBtn = document.getElementById("searchBtn");
const searchResults = document.getElementById("searchResults");
const searchSection = document.getElementById("searchSection");
const selectedSong = document.getElementById("selectedSong");
const selectedCard = document.getElementById("selectedCard");
const recommendations = document.getElementById("recommendations");
const recsGrid = document.getElementById("recsGrid");
const sparklesContainer = document.getElementById("sparkles");
const setupSection = document.getElementById("setupSection");
const apiKeyInput = document.getElementById("apiKeyInput");
const saveKeyBtn = document.getElementById("saveKeyBtn");

const LASTFM_BASE = "https://ws.audioscrobbler.com/2.0/";

// Placeholder image for missing album art (a soft pink music note)
const PLACEHOLDER_IMG =
  "data:image/svg+xml," +
  encodeURIComponent(
    '<svg xmlns="http://www.w3.org/2000/svg" width="120" height="120" viewBox="0 0 120 120">' +
      '<rect width="120" height="120" rx="16" fill="#ffe4f0"/>' +
      '<text x="60" y="72" text-anchor="middle" font-size="48" fill="#e87aa4">&#9835;</text>' +
      "</svg>"
  );

function imgSrc(url) {
  return url || PLACEHOLDER_IMG;
}

// ── API Key Management ────────────────────────────────────
function getApiKey() {
  return localStorage.getItem("lastfm_api_key") || "";
}

function saveApiKey(key) {
  localStorage.setItem("lastfm_api_key", key.trim());
}

// Show setup or search depending on whether we have a key
function initScreen() {
  if (getApiKey()) {
    setupSection.classList.add("hidden");
    searchSection.classList.remove("hidden");
    searchInput.focus();
  } else {
    setupSection.classList.remove("hidden");
    searchSection.classList.add("hidden");
  }
}

saveKeyBtn.addEventListener("click", () => {
  const key = apiKeyInput.value.trim();
  if (!key) return;
  saveApiKey(key);
  initScreen();
});

apiKeyInput.addEventListener("keydown", (e) => {
  if (e.key === "Enter") {
    saveKeyBtn.click();
  }
});

initScreen();

// ── Sparkle Particles ─────────────────────────────────────
function createSparkles() {
  for (let i = 0; i < 25; i++) {
    const sparkle = document.createElement("div");
    sparkle.classList.add("sparkle");
    sparkle.style.left = Math.random() * 100 + "%";
    sparkle.style.animationDuration = 4 + Math.random() * 6 + "s";
    sparkle.style.animationDelay = Math.random() * 8 + "s";
    sparkle.style.width = 4 + Math.random() * 6 + "px";
    sparkle.style.height = sparkle.style.width;
    sparklesContainer.appendChild(sparkle);
  }
}
createSparkles();

// ── Search Debounce ───────────────────────────────────────
let searchTimeout = null;

searchInput.addEventListener("input", () => {
  clearTimeout(searchTimeout);
  const query = searchInput.value.trim();

  if (query.length < 2) {
    hideSearchResults();
    return;
  }

  searchTimeout = setTimeout(() => performSearch(query), 350);
});

searchInput.addEventListener("keydown", (e) => {
  if (e.key === "Enter") {
    clearTimeout(searchTimeout);
    const query = searchInput.value.trim();
    if (query.length >= 2) performSearch(query);
  }
});

searchBtn.addEventListener("click", () => {
  clearTimeout(searchTimeout);
  const query = searchInput.value.trim();
  if (query.length >= 2) performSearch(query);
});

// Close dropdown when clicking outside
document.addEventListener("click", (e) => {
  if (!e.target.closest(".search-section")) {
    hideSearchResults();
  }
});

// ── Last.fm API Helpers ───────────────────────────────────
function pickImage(images) {
  if (!images || !Array.isArray(images)) return "";
  for (let i = images.length - 1; i >= 0; i--) {
    if (images[i]["#text"]) return images[i]["#text"];
  }
  return "";
}

// ── Search ────────────────────────────────────────────────
async function performSearch(query) {
  showSearchLoading();

  try {
    const apiKey = getApiKey();
    const url = `${LASTFM_BASE}?method=track.search&track=${encodeURIComponent(query)}&api_key=${encodeURIComponent(apiKey)}&format=json&limit=5`;
    const res = await fetch(url);
    const data = await res.json();

    if (data.error) {
      if (data.error === 10) {
        // Invalid API key - reset and show setup
        localStorage.removeItem("lastfm_api_key");
        initScreen();
        hideSearchResults();
        return;
      }
      showSearchError(data.message || "something went wrong...");
      return;
    }

    const matches = data.results?.trackmatches?.track || [];
    const tracks = matches.map((track) => ({
      name: track.name,
      artist: track.artist,
      image: pickImage(track.image),
    }));

    if (tracks.length === 0) {
      showNoResults();
      return;
    }

    renderSearchResults(tracks);
  } catch {
    showSearchError("something went wrong... try again?");
  }
}

function renderSearchResults(tracks) {
  searchResults.innerHTML = tracks
    .map(
      (track) => `
    <div class="search-result-item" data-name="${escapeAttr(track.name)}" data-artist="${escapeAttr(track.artist)}" data-image="${escapeAttr(track.image)}">
      <img src="${imgSrc(track.image)}" alt="${escapeAttr(track.name)}" />
      <div class="track-info">
        <div class="track-name">${escapeHtml(track.name)}</div>
        <div class="track-artist">${escapeHtml(track.artist)}</div>
      </div>
    </div>
  `
    )
    .join("");

  searchResults.classList.add("active");

  // Attach click handlers
  searchResults.querySelectorAll(".search-result-item").forEach((item) => {
    item.addEventListener("click", () => selectTrack(item.dataset));
  });
}

function showSearchLoading() {
  searchResults.innerHTML = '<div class="loading">searching...</div>';
  searchResults.classList.add("active");
}

function showNoResults() {
  searchResults.innerHTML =
    '<div class="no-results">no songs found... try a different search?</div>';
  searchResults.classList.add("active");
}

function showSearchError(msg) {
  searchResults.innerHTML = `<div class="no-results">${escapeHtml(msg)}</div>`;
  searchResults.classList.add("active");
}

function hideSearchResults() {
  searchResults.classList.remove("active");
}

// ── Select a Track & Get Recommendations ──────────────────
// Creates a unique key for deduplication
function trackKey(name, artist) {
  return (name + "|||" + artist).toLowerCase().trim();
}

async function selectTrack(data) {
  hideSearchResults();
  searchInput.value = "";

  // Show selected song
  selectedCard.innerHTML = `
    <img src="${imgSrc(data.image)}" alt="${escapeAttr(data.name)}" />
    <div class="track-info">
      <div class="track-name">${escapeHtml(data.name)}</div>
      <div class="track-artist">${escapeHtml(data.artist)}</div>
    </div>
  `;
  selectedSong.classList.remove("hidden");

  // Show loading dots
  recommendations.classList.remove("hidden");
  recsGrid.innerHTML = `
    <div class="loader">
      <div class="dot"></div>
      <div class="dot"></div>
      <div class="dot"></div>
    </div>
  `;

  try {
    const tracks = await getBlendedRecommendations(data.name, data.artist);

    if (tracks.length === 0) {
      recsGrid.innerHTML =
        '<div class="no-results">no similar songs found for this track... try another!</div>';
      return;
    }

    renderRecommendations(tracks);
  } catch {
    recsGrid.innerHTML =
      '<div class="no-results">couldn\'t load recommendations... try again?</div>';
  }
}

// ── Blended Recommendation Engine ─────────────────────────
// 1. Get directly similar tracks (track.getSimilar)
// 2. Get the seed track's mood/genre tags (track.getTopTags)
// 3. Get top tracks for the top 3 tags (tag.getTopTracks)
// 4. Score & blend: tracks from getSimilar get high scores,
//    tracks that also appear in tag results get boosted,
//    tag-only tracks fill remaining spots
async function getBlendedRecommendations(seedTrack, seedArtist) {
  const apiKey = getApiKey();
  const seedKey = trackKey(seedTrack, seedArtist);

  // Fire off similar tracks + top tags in parallel
  const [similarResult, tagsResult] = await Promise.all([
    fetchJson(
      `${LASTFM_BASE}?method=track.getSimilar&track=${enc(seedTrack)}&artist=${enc(seedArtist)}&api_key=${enc(apiKey)}&format=json&limit=20&autocorrect=1`
    ),
    fetchJson(
      `${LASTFM_BASE}?method=track.getTopTags&track=${enc(seedTrack)}&artist=${enc(seedArtist)}&api_key=${enc(apiKey)}&format=json&autocorrect=1`
    ),
  ]);

  // Parse similar tracks
  const similarTracks = (similarResult.similartracks?.track || []).map((t) => ({
    name: t.name,
    artist: t.artist?.name || "",
    image: pickImage(t.image),
    match: parseFloat(t.match) || 0,
  }));

  // Parse tags - filter out generic ones, take top 3
  const genericTags = new Set([
    "seen live", "favorites", "favourite", "favorites", "my favorite",
    "love", "loved", "beautiful", "awesome", "amazing", "cool",
  ]);
  const topTags = (tagsResult.toptags?.tag || [])
    .filter((t) => !genericTags.has(t.name.toLowerCase()))
    .slice(0, 3)
    .map((t) => t.name);

  // Fetch top tracks for each tag in parallel
  const tagTrackResults = await Promise.all(
    topTags.map((tag) =>
      fetchJson(
        `${LASTFM_BASE}?method=tag.getTopTracks&tag=${enc(tag)}&api_key=${enc(apiKey)}&format=json&limit=20`
      )
    )
  );

  // Build a set of track keys from tag results for quick lookup
  const tagTrackKeys = new Set();
  const tagTracksMap = new Map(); // key -> track data
  for (const result of tagTrackResults) {
    for (const t of result.tracks?.track || []) {
      const key = trackKey(t.name, t.artist?.name || "");
      tagTrackKeys.add(key);
      if (!tagTracksMap.has(key)) {
        tagTracksMap.set(key, {
          name: t.name,
          artist: t.artist?.name || "",
          image: pickImage(t.image),
        });
      }
    }
  }

  // Score all tracks
  const scored = new Map(); // key -> { track, score }

  // Similar tracks get a base score of 50-100 based on match value
  for (const t of similarTracks) {
    const key = trackKey(t.name, t.artist);
    if (key === seedKey) continue;
    const baseScore = 50 + t.match * 50;
    // Boost if also found in tag results (shared vibe!)
    const tagBoost = tagTrackKeys.has(key) ? 25 : 0;
    scored.set(key, {
      track: t,
      score: baseScore + tagBoost,
    });
  }

  // Tag-only tracks get a lower score (so they fill in if getSimilar is sparse)
  for (const [key, t] of tagTracksMap) {
    if (key === seedKey) continue;
    if (scored.has(key)) continue; // already scored from similar
    scored.set(key, {
      track: t,
      score: 20, // lower priority than similar tracks
    });
  }

  // Sort by score descending, take top 10
  const ranked = [...scored.values()]
    .sort((a, b) => b.score - a.score)
    .slice(0, 10)
    .map((entry) => ({
      name: entry.track.name,
      artist: entry.track.artist,
      image: entry.track.image,
      spotifyUrl: `https://open.spotify.com/search/${encodeURIComponent(entry.track.name + " " + entry.track.artist)}`,
    }));

  return ranked;
}

function enc(str) {
  return encodeURIComponent(str);
}

async function fetchJson(url) {
  try {
    const res = await fetch(url);
    return await res.json();
  } catch {
    return {};
  }
}

function renderRecommendations(tracks) {
  recsGrid.innerHTML = tracks
    .map(
      (track, i) => `
    <a href="${escapeAttr(track.spotifyUrl)}" target="_blank" rel="noopener noreferrer" class="rec-card" style="animation-delay: ${i * 0.06}s">
      <span class="rec-number">${i + 1}</span>
      <img src="${imgSrc(track.image)}" alt="${escapeAttr(track.name)}" />
      <div class="track-info">
        <div class="track-name">${escapeHtml(track.name)}</div>
        <div class="track-artist">${escapeHtml(track.artist)}</div>
      </div>
      <svg class="spotify-icon" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
        <polyline points="15 3 21 3 21 9" />
        <line x1="10" y1="14" x2="21" y2="3" />
      </svg>
    </a>
  `
    )
    .join("");
}

// ── Helpers ───────────────────────────────────────────────
function escapeHtml(str) {
  const div = document.createElement("div");
  div.textContent = str;
  return div.innerHTML;
}

function escapeAttr(str) {
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}
