// static/script.js - complete launcher frontend with token hide/show behavior
const grid = document.getElementById("grid");
const tokenInput = document.getElementById("token");
const saveBtn = document.getElementById("saveToken");
const tokenContainer = document.getElementById("tokenContainer");
const tokenStatus = document.getElementById("tokenStatus");
const changeBtn = document.getElementById("changeToken");

function isImagePath(p) {
  if (!p || typeof p !== "string") return false;
  const lower = p.toLowerCase();
  return lower.endsWith(".png") || lower.endsWith(".jpg") || lower.endsWith(".jpeg") || lower.endsWith(".svg") || lower.startsWith("/static/");
}

/* ----------------- Token handling ----------------- */
function loadToken() {
  const t = localStorage.getItem("launch_token") || "";
  tokenInput.value = t;
  if (t) {
    // hide input, show status
    if (tokenContainer) tokenContainer.style.display = "none";
    if (tokenStatus) tokenStatus.style.display = "inline-flex";
  } else {
    if (tokenContainer) tokenContainer.style.display = "flex";
    if (tokenStatus) tokenStatus.style.display = "none";
  }
}

function saveToken() {
  const val = tokenInput.value.trim();
  if (!val) { alert("Please enter a token before saving."); tokenInput.focus(); return; }
  localStorage.setItem("launch_token", val);
  // hide input, show status
  if (tokenContainer) tokenContainer.style.display = "none";
  if (tokenStatus) tokenStatus.style.display = "inline-flex";
  // small visual feedback
  saveBtn.disabled = true;
  setTimeout(()=> { saveBtn.disabled = false; }, 300);
}

function clearTokenUIAndShowInput() {
  // show token input for change
  if (tokenContainer) tokenContainer.style.display = "flex";
  if (tokenStatus) tokenStatus.style.display = "none";
  tokenInput.focus();
}

/* Attach token button handlers */
if (saveBtn) saveBtn.addEventListener("click", saveToken);
if (changeBtn) changeBtn.addEventListener("click", () => {
  // allow user to change token
  clearTokenUIAndShowInput();
});

/* Initialize token UI */
loadToken();

/* ----------------- Config & grid rendering ----------------- */
async function fetchConfig() {
  try {
    const res = await fetch("/config");
    if (!res.ok) {
      alert("Failed to load config: " + res.status);
      return [];
    }
    return await res.json();
  } catch (e) {
    alert("Failed to fetch config: " + e.message);
    return [];
  }
}

function makeTile(item) {
  const div = document.createElement("div");
  div.className = "tile";

  let iconHTML;
  if (isImagePath(item.icon)) {
    const safeSrc = item.icon;
    iconHTML = `<img src="${safeSrc}" alt="${item.label} icon" class="icon-img" onerror="this.style.display='none'"/>`;
  } else {
    iconHTML = `<div class="icon">${item.icon || "🎮"}</div>`;
  }

  div.innerHTML = `${iconHTML}
                   <div class="label">${item.label}</div>`;

  div.addEventListener("click", (ev) => {
    launch(item.id, ev);
  });

  return div;
}

async function launch(id, ev) {
  const token = localStorage.getItem("launch_token") || "";
  if (!token) {
    alert("Set token in the box below (must match server token).");
    // make input visible in case user wants to set it now
    if (tokenContainer) tokenContainer.style.display = "flex";
    if (tokenStatus) tokenStatus.style.display = "none";
    return;
  }
  try {
    const resp = await fetch(`/launch/${id}`, {
      method: "POST",
      headers: { "X-Launch-Token": token }
    });
    const json = await resp.json();
    if (!json.ok) {
      alert("Error: " + (json.error || "unknown"));
    } else {
      // small visual feedback: flash the tile
      const tile = ev?.currentTarget;
      if (tile) {
        tile.style.opacity = "0.6";
        setTimeout(()=> tile.style.opacity = "1", 220);
      }
    }
  } catch (e) {
    alert("Launch request failed: " + e.message);
  }
}

/* Render grid on load */
(async () => {
  const cfg = await fetchConfig();
  if (!Array.isArray(cfg)) return;
  cfg.forEach(item => {
    const t = makeTile(item);
    grid.appendChild(t);
  });
})();
