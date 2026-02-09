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

  // Fetch recommendations directly from Last.fm
  try {
    const apiKey = getApiKey();
    const url = `${LASTFM_BASE}?method=track.getSimilar&track=${encodeURIComponent(data.name)}&artist=${encodeURIComponent(data.artist)}&api_key=${encodeURIComponent(apiKey)}&format=json&limit=10&autocorrect=1`;
    const res = await fetch(url);
    const result = await res.json();

    if (result.error) {
      recsGrid.innerHTML = `<div class="no-results">${escapeHtml(result.message || "something went wrong...")}</div>`;
      return;
    }

    const similar = result.similartracks?.track || [];
    const tracks = similar.map((t) => ({
      name: t.name,
      artist: t.artist?.name || "",
      image: pickImage(t.image),
      spotifyUrl: `https://open.spotify.com/search/${encodeURIComponent(t.name + " " + (t.artist?.name || ""))}`,
    }));

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
