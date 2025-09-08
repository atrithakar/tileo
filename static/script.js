// simple frontend: fetch config and render tiles. call /launch/<id> with token header.
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
  return res.json();
}

function makeTile(item) {
  const div = document.createElement("div");
  div.className = "tile";
  div.innerHTML = `<div class="icon">${item.icon || "🎮"}</div>
                   <div class="label">${item.label}</div>`;
  div.addEventListener("click", () => {
    launch(item.id);
  });
  return div;
}

async function launch(id) {
  const token = localStorage.getItem("launch_token") || "";
  if (!token) {
    alert("Set token in the box below (must match server token).");
    return;
  }
  const resp = await fetch(`/launch/${id}`, {
    method: "POST",
    headers: {
      "X-Launch-Token": token
    }
  });
  const json = await resp.json();
  if (!json.ok) {
    alert("Error: " + (json.error || "unknown"));
  } else {
    // little feedback
    const tile = event?.currentTarget;
    console.log("Launched", id);
  }
}

(async () => {
  const cfg = await fetchConfig();
  // cfg is array of {id,label,icon}
  cfg.forEach(item => {
    const t = makeTile(item);
    grid.appendChild(t);
  });
})();
