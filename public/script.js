// ── DOM Elements ──────────────────────────────────────────
const searchInput = document.getElementById("searchInput");
const searchBtn = document.getElementById("searchBtn");
const searchResults = document.getElementById("searchResults");
const selectedSong = document.getElementById("selectedSong");
const selectedCard = document.getElementById("selectedCard");
const recommendations = document.getElementById("recommendations");
const recsGrid = document.getElementById("recsGrid");
const sparklesContainer = document.getElementById("sparkles");

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

// ── Search ────────────────────────────────────────────────
async function performSearch(query) {
  showSearchLoading();

  try {
    const res = await fetch(`/api/search?q=${encodeURIComponent(query)}`);
    const tracks = await res.json();

    if (tracks.error) {
      showSearchError(tracks.error);
      return;
    }

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

  // Fetch recommendations using track name + artist (Last.fm API)
  try {
    const res = await fetch(
      `/api/recommendations?track=${encodeURIComponent(data.name)}&artist=${encodeURIComponent(data.artist)}`
    );
    const tracks = await res.json();

    if (tracks.error) {
      recsGrid.innerHTML = `<div class="no-results">${escapeHtml(tracks.error)}</div>`;
      return;
    }

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
