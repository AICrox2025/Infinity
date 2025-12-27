const { ipcRenderer } = require("electron"); 

const webview = document.getElementById("webview");
const home = document.getElementById("home");

const urlInput = document.getElementById("url");
const searchInput = document.getElementById("searchInput");
const engineSelect = document.getElementById("engineSelect");
const engineIcon = document.getElementById("engineIcon");

const searchBtn = document.getElementById("searchBtn");
const homeBtn = document.getElementById("homeBtn");
const chatBtn = document = document.getElementById("chatBtn");
const backBtn = document.getElementById("back");
const forwardBtn = document.getElementById("forward");

// --- Elementy pre Progress Bar (NOVÉ PRE CHROME STYLE) ---
const downloadsBar = document.getElementById("downloads-bar");
// Uchováva zoznam aktívnych sťahovaní podľa ich ID
const activeDownloads = new Map();

// --- Update engine icon ---
function updateEngineIcon() {
  engineIcon.src = engineSelect.value === "duckduckgo" ? "assets/duckduckgo.svg" : "assets/google.svg";
}
engineSelect.addEventListener("change", updateEngineIcon);
updateEngineIcon();

// --- Navigate function ---
function navigate(query) {
  if (!query) return;

  let url = query.includes(".")
    ? (query.startsWith("http") ? query : "https://" + query)
    : engineSelect.value === "duckduckgo"
      ? `https://duckduckgo.com/?q=${encodeURIComponent(query)}`
      : `https://www.google.com/search?q=${encodeURIComponent(query)}`;

  webview.src = url;
  home.style.display = "none";
  webview.style.display = "flex";
}

// --- Event listeners ---
searchBtn.addEventListener("click", () => navigate(searchInput.value));
searchInput.addEventListener("keydown", e => { if(e.key === "Enter") navigate(searchInput.value); });
urlInput.addEventListener("keydown", e => { if(e.key === "Enter") navigate(urlInput.value); });

// --- Update URL bar on navigation ---
webview.addEventListener("did-navigate", () => { urlInput.value = webview.getURL(); });

// --- Back / Forward buttons ---
backBtn.addEventListener("click", () => { if(webview.canGoBack()) webview.goBack(); });
forwardBtn.addEventListener("click", () => { if(webview.canGoForward()) webview.goForward(); });

// --- Home button (domček) ---
homeBtn.addEventListener("click", () => {
  webview.style.display = "none";
  home.style.display = "flex";
});

// --- Chat / Rocket button ---
chatBtn.addEventListener("click", () => {
  webview.src = "rocket.html";  // tu zmeníme na rocket.html
  webview.style.display = "flex";
  home.style.display = "none";
});

// --- NOVÁ LOGIKA PRE CHROME STYLE DOWNLOADS BAR ---

/**
 * Vytvorí nový HTML element pre sťahovaný súbor
 * @param {string} id Unikátne ID sťahovania
 * @param {string} fileName Názov súboru
 */
function createDownloadItem(id, fileName) {
  const itemDiv = document.createElement('div');
  itemDiv.id = `download-${id}`;
  itemDiv.classList.add('download-item');
  itemDiv.innerHTML = `
    <span class="filename">${fileName}</span>
    <button class="close-btn" onclick="removeDownloadItem('${id}')">✕</button>
    <div class="download-progress" id="progress-${id}"></div>
  `;
  downloadsBar.appendChild(itemDiv);
  activeDownloads.set(id, itemDiv);
  downloadsBar.style.display = 'flex'; // Zobrazí lištu
}

/**
 * Odstráni položku sťahovania z lišty
 * @param {string} id Unikátne ID sťahovania
 */
function removeDownloadItem(id) {
  const item = activeDownloads.get(id);
  if (item) {
    item.remove();
    activeDownloads.delete(id);
    // Skryje lištu, ak už nič nesťahujeme
    if (activeDownloads.size === 0) {
      downloadsBar.style.display = 'none';
    }
  }
}

// Global scope funkcia pre použitie v inline onclick (pretože contextIsolation je false/nodeIntegration true)
window.removeDownloadItem = removeDownloadItem;


// Počúvanie udalostí z main.js
ipcRenderer.on('download-update', (event, data) => {
  const { id, percent, fileName, state } = data;
  let item = activeDownloads.get(id);

  if (!item && state !== 'completed' && state !== 'cancelled') {
    // Vytvoríme novú položku, ak ešte neexistuje a sťahovanie prebieha
    createDownloadItem(id, fileName);
    item = activeDownloads.get(id);
  }

  if (item) {
    const progressBar = item.querySelector('.download-progress');
    if (state === 'progressing') {
      progressBar.style.width = percent + '%';
    } else if (state === 'completed') {
      // Po dokončení zmeníme farbu na zelenú a po chvíli skryjeme
      progressBar.style.backgroundColor = '#28a745'; 
      setTimeout(() => removeDownloadItem(id), 5000); // Zmizne po 5 sekundách
    } else if (state === 'cancelled' || state === 'interrupted') {
      removeDownloadItem(id);
    }
  }
});

