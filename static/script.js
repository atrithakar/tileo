// static/script.js - image-aware launcher frontend
const grid = document.getElementById("grid");
const tokenInput = document.getElementById("token");
const saveBtn = document.getElementById("saveToken");

function loadToken() {
  const t = localStorage.getItem("launch_token") || "";
  tokenInput.value = t;
}
function saveToken() {
  localStorage.setItem("launch_token", tokenInput.value.trim());
  alert("Saved token locally for this browser.");
}

saveBtn.addEventListener("click", saveToken);
loadToken();

async function fetchConfig() {
  const res = await fetch("/config");
  if (!res.ok) {
    alert("Failed to load config: " + res.status);
    return [];
  }
  return res.json();
}

function isImagePath(p) {
  if (!p || typeof p !== "string") return false;
  const lower = p.toLowerCase();
  return lower.endsWith(".png") || lower.endsWith(".jpg") || lower.endsWith(".jpeg") || lower.endsWith(".svg") || lower.startsWith("/static/");
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

(async () => {
  const cfg = await fetchConfig();
  if (!Array.isArray(cfg)) return;
  cfg.forEach(item => {
    const t = makeTile(item);
    grid.appendChild(t);
  });
})();
