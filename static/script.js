// static/script.js - TileO with System Controls first page

const PAGES_WRAP = document.getElementById('pagesWrap');
const PAGER = document.getElementById('pager');
const gridPageSize = 8; // tiles per page

// token UI
const tokenInput = document.getElementById("token");
const saveBtn = document.getElementById("saveToken");
const tokenContainer = document.getElementById("tokenContainer");
const tokenStatus = document.getElementById("tokenStatus");
const changeBtn = document.getElementById("changeToken");

function loadTokenUI() {
  const t = localStorage.getItem("launch_token") || "";
  if (t) {
    if (tokenContainer) tokenContainer.style.display = "none";
    if (tokenStatus) tokenStatus.style.display = "inline-flex";
  } else {
    if (tokenContainer) tokenContainer.style.display = "flex";
    if (tokenStatus) tokenStatus.style.display = "none";
  }
}
function saveToken() {
  const val = (tokenInput && tokenInput.value || "").trim();
  if (!val) { alert("Enter token"); return; }
  localStorage.setItem("launch_token", val);
  loadTokenUI();
}
function showTokenInputForChange(){
  if (tokenContainer) tokenContainer.style.display = "flex";
  if (tokenStatus) tokenStatus.style.display = "none";
  if (tokenInput) tokenInput.focus();
}
if (saveBtn) saveBtn.addEventListener("click", saveToken);
if (changeBtn) changeBtn.addEventListener("click", showTokenInputForChange);
loadTokenUI();

// fetch config
async function fetchConfig() {
  try {
    const res = await fetch("/config");
    if (!res.ok) { console.error("config fetch failed", res.status); return []; }
    const json = await res.json();
    return Array.isArray(json) ? json : json;
  } catch (e) {
    console.error("fetch config error", e);
    return [];
  }
}

// UTIL: chunk array into pages of size n
function chunkArray(arr, n){
  const out = [];
  for (let i=0; i<arr.length; i+=n) out.push(arr.slice(i,i+n));
  return out;
}

// create a tile element
function makeTile(item) {
  const div = document.createElement("div");
  div.className = "tile";

  let iconHTML = '';
  if (item.icon && (item.icon.endsWith('.png') || item.icon.endsWith('.webp') || item.icon.endsWith('.svg') || item.icon.endsWith('.jpg') || item.icon.endsWith('.jpeg'))) {
    iconHTML = `<img src="${item.icon}" alt="${item.label} icon" class="icon-img" onerror="this.style.display='none'"/>`;
  } else {
    iconHTML = `<div class="icon">${item.label?.charAt(0) || "?"}</div>`;
  }

  div.innerHTML = `${iconHTML}
                   <div class="label">${item.label}</div>`;

  div.addEventListener("click", () => launch(item.id));
  return div;
}

// LAUNCH POST
async function launch(id) {
  const token = localStorage.getItem("launch_token") || "";
  if (!token) { alert("Save token first"); showTokenInputForChange(); return; }
  try {
    const resp = await fetch(`/launch/${encodeURIComponent(id)}`, { method: "POST", headers: { "X-Launch-Token": token }});
    const json = await resp.json().catch(()=>({ok:false}));
    if (!json.ok) alert("Launch failed: "+(json.error||"unknown"));
  } catch (e) {
    alert("Launch request error: "+e.message);
  }
}

// RENDER PAGER DOTS
function setActiveDot(idx){
  const dots = Array.from(PAGER.children);
  dots.forEach((d,i)=> d.classList.toggle('active', i===idx));
}

// SCROLL update
function updateActiveDotOnScroll(){
  const pages = Array.from(PAGES_WRAP.children);
  if (pages.length===0) return;
  const scrollLeft = PAGES_WRAP.scrollLeft;
  let closest = 0; let minDiff = Infinity;
  pages.forEach((p,i) => {
    const diff = Math.abs(p.offsetLeft - scrollLeft);
    if (diff < minDiff) { minDiff = diff; closest = i; }
  });
  setActiveDot(closest);
}

// Build system controls DOM (first page)
function buildSystemPage() {
  const page = document.createElement("section");
  page.className = "grid-page system-page";
  page.setAttribute("data-page","system");

  // Top sliders
  const sliders = document.createElement("div");
  sliders.className = "sys-sliders";

  // Brightness slider
  const brightnessCard = document.createElement("div");
  brightnessCard.className = "slider-card";
  brightnessCard.innerHTML = `
    <div class="slider-label">
      <div>Brightness</div>
      <div id="brightnessVal">--%</div>
    </div>
    <input id="brightnessSlider" class="slider" type="range" min="0" max="100" value="50">
  `;
  sliders.appendChild(brightnessCard);

  // Volume slider
  const volumeCard = document.createElement("div");
  volumeCard.className = "slider-card";
  volumeCard.innerHTML = `
    <div class="slider-label">
      <div>Volume</div>
      <div id="volumeVal">--%</div>
    </div>
    <input id="volumeSlider" class="slider" type="range" min="0" max="100" value="50">
  `;
  sliders.appendChild(volumeCard);

  page.appendChild(sliders);

  // Middle row (music | power | toggles | clock)
  const mid = document.createElement("div");
  mid.className = "sys-middle";

  // Music card
  const music = document.createElement("div");
  music.className = "music-card";
  music.innerHTML = `
    <div class="music-title" id="musicTitle">No track</div>
    <div class="music-progress">
      <div class="music-time" id="musicTimeLeft">00:00</div>
      <input id="musicProgress" class="slider music-prog" type="range" min="0" max="100" value="0">
      <div class="music-time" id="musicTimeRight">00:00</div>
    </div>
    <div class="music-controls">
      <button class="sys-btn" id="musicPrev">⏮</button>
      <button class="sys-btn" id="musicPlay">⏯</button>
      <button class="sys-btn" id="musicNext">⏭</button>
      <button class="sys-btn" id="musicStop">⏹</button>
    </div>
  `;
  mid.appendChild(music);

  // Power card
  const power = document.createElement("div");
  power.className = "power-card";
  power.innerHTML = `
    <button class="sys-btn" data-power="shutdown">Shutdown</button>
    <button class="sys-btn" data-power="restart">Restart</button>
    <button class="sys-btn" data-power="hibernate">Hibernate</button>
    <button class="sys-btn" data-power="sleep">Sleep</button>
  `;
  mid.appendChild(power);

  // Toggles card
  const toggles = document.createElement("div");
  toggles.className = "toggles-card";
  toggles.innerHTML = `
    <button class="sys-btn" id="toggleMute">Toggle Mute</button>
    <button class="sys-btn" id="toggleTheme">Toggle Dark/Light</button>
  `;
  mid.appendChild(toggles);

  // Clock card
  const clock = document.createElement("div");
  clock.className = "clock-card";
  clock.innerHTML = `
    <div class="clock-large" id="clockDate">--/--/----</div>
    <div class="clock-small" id="clockTime">--:--:--</div>
  `;
  mid.appendChild(clock);

  page.appendChild(mid);

  // bottom spacer
  const bottom = document.createElement("div");
  bottom.className = "sys-bottom";
  page.appendChild(bottom);

  // append system page to pagesWrap
  PAGES_WRAP.appendChild(page);

  // wire controls
  setTimeout(setupSystemHandlers, 100);
}

// Setup handlers for system controls
function setupSystemHandlers() {
  const volSlider = document.getElementById("volumeSlider");
  const volVal = document.getElementById("volumeVal");
  const briSlider = document.getElementById("brightnessSlider");
  const briVal = document.getElementById("brightnessVal");

  const musicTitle = document.getElementById("musicTitle");
  const musicProgress = document.getElementById("musicProgress");
  const musicTimeLeft = document.getElementById("musicTimeLeft");
  const musicTimeRight = document.getElementById("musicTimeRight");
  const musicPlay = document.getElementById("musicPlay");
  const musicPrev = document.getElementById("musicPrev");
  const musicNext = document.getElementById("musicNext");
  const musicStop = document.getElementById("musicStop");

  const toggleMute = document.getElementById("toggleMute");
  const toggleTheme = document.getElementById("toggleTheme");

  const powerButtons = Array.from(document.querySelectorAll('.power-card .sys-btn'));

  // initial refresh of values (best effort)
  refreshSystemStatus();

  // sliders: debounce to avoid flooding server
  let volTimer = null;
  volSlider.addEventListener("input", () => {
    volVal.textContent = volSlider.value + "%";
  });
  volSlider.addEventListener("change", () => {
    if (volTimer) clearTimeout(volTimer);
    volTimer = setTimeout(()=> {
      fetch("/system/volume", { method:"POST", headers: {'Content-Type':'application/json'}, body: JSON.stringify({value: Number(volSlider.value)}) })
        .then(r=>r.json()).then(j => { if (!j.ok) console.warn("vol err", j) })
      ;
    }, 150);
  });

  let briTimer = null;
  briSlider.addEventListener("input", () => {
    briVal.textContent = briSlider.value + "%";
  });
  briSlider.addEventListener("change", () => {
    if (briTimer) clearTimeout(briTimer);
    briTimer = setTimeout(()=> {
      fetch("/system/brightness", { method:"POST", headers: {'Content-Type':'application/json'}, body: JSON.stringify({value: Number(briSlider.value)}) })
        .then(r=>r.json()).then(j => { if (!j.ok) console.warn("bri err", j) })
      ;
    }, 150);
  });

  // music controls
  musicPlay.addEventListener("click", ()=> fetch("/system/media", { method:"POST", headers:{'Content-Type':'application/json'}, body: JSON.stringify({action:'playpause'}) }));
  musicPrev.addEventListener("click", ()=> fetch("/system/media", { method:"POST", headers:{'Content-Type':'application/json'}, body: JSON.stringify({action:'prev'}) }));
  musicNext.addEventListener("click", ()=> fetch("/system/media", { method:"POST", headers:{'Content-Type':'application/json'}, body: JSON.stringify({action:'next'}) }));
  musicStop.addEventListener("click", ()=> fetch("/system/media", { method:"POST", headers:{'Content-Type':'application/json'}, body: JSON.stringify({action:'stop'}) }));

  // toggles
  toggleMute.addEventListener("click", ()=> fetch("/system/mute", { method:"POST" }));
  toggleTheme.addEventListener("click", ()=> fetch("/system/theme", { method:"POST" }));

  // power
  powerButtons.forEach(b => b.addEventListener("click", (ev) => {
    const action = ev.currentTarget.getAttribute("data-power");
    if (!confirm(`Confirm ${action}?`)) return;
    fetch(`/system/power`, { method:"POST", headers:{'Content-Type':'application/json'}, body: JSON.stringify({action}) })
      .then(r=>r.json()).then(j=> { if (!j.ok) alert("power failed: "+(j.error||"unknown")) });
  }));

  // clock update
  setInterval(()=> {
    const d = new Date();
    const dd = String(d.getDate()).padStart(2,'0');
    const mm = String(d.getMonth()+1).padStart(2,'0');
    const yyyy = d.getFullYear();
    const hh = String(d.getHours()).padStart(2,'0');
    const mi = String(d.getMinutes()).padStart(2,'0');
    const ss = String(d.getSeconds()).padStart(2,'0');
    document.getElementById("clockDate").textContent = `${dd}/${mm}/${yyyy}`;
    document.getElementById("clockTime").textContent = `${hh}:${mi}:${ss}`;
  }, 1000);
}

// Fetch initial system status: volume/brightness (best-effort)
function refreshSystemStatus(){
  // get volume
  fetch("/system/status").then(r=>r.json()).then(j=>{
    if (!j) return;
    try {
      if (j.volume !== undefined) {
        const vs = Math.round(j.volume);
        const volSlider = document.getElementById("volumeSlider");
        if (volSlider) { volSlider.value = vs; document.getElementById("volumeVal").textContent = vs + "%"; }
      }
      if (j.brightness !== undefined) {
        const bs = Math.round(j.brightness);
        const briSlider = document.getElementById("brightnessSlider");
        if (briSlider) { briSlider.value = bs; document.getElementById("brightnessVal").textContent = bs + "%"; }
      }
      if (j.now_playing) {
        const musicTitle = document.getElementById("musicTitle");
        musicTitle.textContent = j.now_playing.title || "Now playing";
      }
    } catch(e) { console.warn("refresh sys parse", e); }
  }).catch(()=>{});
}

// Render pages: system page first, then app pages
async function renderAllPages() {
  PAGES_WRAP.innerHTML = "";
  PAGER.innerHTML = "";

  // build system page first
  buildSystemPage();

  // fetch app config and create pages
  const cfg = await fetchConfig();
  const items = cfg.map((it, idx) => {
    if (!it.id) it.id = it.label?.toLowerCase().replace(/\s+/g,'-') || `item-${idx}`;
    return it;
  });

  // chunk into pages of gridPageSize
  const pages = chunkArray(items, gridPageSize);

  pages.forEach((pageItems, pageIndex) => {
    const pageEl = document.createElement("section");
    pageEl.className = "grid-page";
    pageEl.setAttribute("data-page", `apps-${pageIndex}`);

    const grid = document.createElement("div");
    grid.className = "grid";

    pageItems.forEach(it => grid.appendChild(makeTile(it)));
    pageEl.appendChild(grid);
    PAGES_WRAP.appendChild(pageEl);

    // pager dot (note: system page takes index 0)
    const dot = document.createElement("div");
    dot.className = "page-dot";
    const dotIndex = pageIndex + 1; // +1 because system page is first
    dot.addEventListener("click", ()=> {
      const target = PAGES_WRAP.children[dotIndex];
      if (target) PAGES_WRAP.scrollTo({ left: target.offsetLeft, behavior:'smooth' });
      setActiveDot(dotIndex);
    });
    PAGER.appendChild(dot);
  });

  // add a dot for system page at start
  const sysDot = document.createElement("div");
  sysDot.className = "page-dot active";
  sysDot.addEventListener("click", ()=> { PAGES_WRAP.scrollTo({ left: 0, behavior:'smooth' }); setActiveDot(0); });
  PAGER.insertBefore(sysDot, PAGER.firstChild);

  // set up scroll listener to update dots
  PAGES_WRAP.addEventListener('scroll', ()=> {
    window.requestAnimationFrame(updateActiveDotOnScroll);
  });
}

// initial run
renderAllPages();
