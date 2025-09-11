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

  // System monitoring card (replacing music card)
  const monitoring = document.createElement("div");
  monitoring.className = "monitoring-card";
  monitoring.innerHTML = `
    <div class="monitoring-grid">
      <div class="monitor-item">
        <span class="monitor-label">CPU Usage</span>
        <span class="monitor-value" id="cpuUsage">--%</span>
      </div>
      <div class="monitor-item">
        <span class="monitor-label">CPU Temp</span>
        <span class="monitor-value" id="cpuTemp">--°C</span>
      </div>
      <div class="monitor-item">
        <span class="monitor-label">GPU Usage</span>
        <span class="monitor-value" id="gpuUsage">--%</span>
      </div>
      <div class="monitor-item">
        <span class="monitor-label">GPU Temp</span>
        <span class="monitor-value" id="gpuTemp">--°C</span>
      </div>
      <div class="monitor-item">
        <span class="monitor-label">RAM Usage</span>
        <span class="monitor-value" id="ramUsage">--%</span>
      </div>
      <div class="monitor-item">
        <span class="monitor-label">Battery</span>
        <span class="monitor-value" id="batteryLevel">--%</span>
      </div>
    </div>
  `;
  mid.appendChild(monitoring);

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
    <button class="sys-btn" id="nextPageBtn">Next Page</button>
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

  // wire controls immediately
  setupSystemHandlers();
}

// Setup handlers for system controls
function setupSystemHandlers() {
  const volSlider = document.getElementById("volumeSlider");
  const volVal = document.getElementById("volumeVal");
  const briSlider = document.getElementById("brightnessSlider");
  const briVal = document.getElementById("brightnessVal");

  const toggleMute = document.getElementById("toggleMute");
  const toggleTheme = document.getElementById("toggleTheme");
  const nextPageBtn = document.getElementById("nextPageBtn");

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

  // toggles
  toggleMute.addEventListener("click", ()=> fetch("/system/mute", { method:"POST" }));
  toggleTheme.addEventListener("click", ()=> fetch("/system/theme", { method:"POST" }));
  
  // Next Page button
  if (nextPageBtn) {
    nextPageBtn.addEventListener("click", ()=> {
      if (PAGES_WRAP.children.length > 1) {
        const firstAppPage = PAGES_WRAP.children[1];
        if (firstAppPage) {
          PAGES_WRAP.scrollTo({ left: firstAppPage.offsetLeft, behavior: 'smooth' });
          setActiveDot(1);
        }
      }
    });
  }
  
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
    const clockDate = document.getElementById("clockDate");
    const clockTime = document.getElementById("clockTime");
    if (clockDate) clockDate.textContent = `${dd}/${mm}/${yyyy}`;
    if (clockTime) clockTime.textContent = `${hh}:${mi}:${ss}`;
  }, 1000);
}


// Update system monitoring data
function updateSystemMonitoring() {
  console.log("Updating system monitoring data...");
  fetch("/system/monitoring").then(r=>r.json()).then(data=>{
    console.log("Monitoring data received:", data);
    if (!data) return;
    try {
      if (data.cpu_usage !== undefined) {
        const elem = document.getElementById("cpuUsage");
        if (elem) elem.textContent = Math.round(data.cpu_usage) + "%";
      }
      if (data.cpu_temp !== undefined) {
        const elem = document.getElementById("cpuTemp");
        if (elem) elem.textContent = Math.round(data.cpu_temp) + "°C";
      }
      if (data.gpu_usage !== undefined) {
        const elem = document.getElementById("gpuUsage");
        if (elem) elem.textContent = Math.round(data.gpu_usage) + "%";
      }
      if (data.gpu_temp !== undefined) {
        const elem = document.getElementById("gpuTemp");
        if (elem) elem.textContent = Math.round(data.gpu_temp) + "°C";
      }
      if (data.ram_usage !== undefined) {
        const elem = document.getElementById("ramUsage");
        if (elem) elem.textContent = Math.round(data.ram_usage) + "%";
      }
      if (data.battery_level !== undefined) {
        const elem = document.getElementById("batteryLevel");
        if (elem) elem.textContent = Math.round(data.battery_level) + "%";
      }
    } catch(e) { console.warn("monitoring data parse error", e); }
  }).catch((error)=>{
    console.error("Failed to fetch monitoring data:", error);
  });
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

  // Setup atomic scrolling functionality with selective blocking
  setupSwipePaging();
}

// initial run
renderAllPages();

// Setup system monitoring after page loads
setTimeout(() => {
  console.log("Setting up system monitoring interval...");
  setInterval(updateSystemMonitoring, 2000);
  updateSystemMonitoring(); // Initial update
  console.log("System monitoring setup complete");
}, 1000);

// Setup atomic scrolling functionality
function setupSwipePaging() {
  let startX = null;
  let startY = null;
  let dragging = false;
  let blocked = false;
  const SWIPE_THRESHOLD = 60;

  // Check if element is a control that should block swiping
  function isControlElement(element) {
    if (!element) return false;
    
    const controlSelectors = [
      '.slider', '.music-prog', '.sys-btn', '.slider-card', '.music-card',
      '.power-card', '.toggles-card', '.clock-card', 'input', 'button'
    ];
    
    return controlSelectors.some(sel => element.closest && element.closest(sel));
  }

  // Get current page index
  function getCurrentPageIndex() {
    const pageWidth = PAGES_WRAP.clientWidth;
    return Math.round(PAGES_WRAP.scrollLeft / (pageWidth || 1));
  }

  // Go to specific page
  function goToPage(pageIndex) {
    const totalPages = PAGES_WRAP.children.length;
    if (pageIndex < 0 || pageIndex >= totalPages) return;
    
    const pageWidth = PAGES_WRAP.clientWidth;
    const targetScrollLeft = pageIndex * pageWidth;
    
    PAGES_WRAP.scrollTo({ 
      left: targetScrollLeft, 
      behavior: 'smooth' 
    });
    
    setActiveDot(pageIndex);
  }

  // Touch start
  document.addEventListener('touchstart', (e) => {
    const currentPage = getCurrentPageIndex();
    
    // BLOCK ALL SWIPING on page 0 (system controls)
    if (currentPage === 0) {
      blocked = true;
      startX = null;
      startY = null;
      console.log('BLOCKED: On system controls page - NO SWIPING');
      return;
    }

    // On other pages, block only if touching controls
    if (isControlElement(e.target)) {
      blocked = true;
      startX = null;
      startY = null;
      console.log('BLOCKED: Touching control element');
      return;
    }

    blocked = false;
    startX = e.touches[0].clientX;
    startY = e.touches[0].clientY;
    dragging = false;
    console.log(`ALLOWED: Swiping enabled on page ${currentPage}`);
  }, { passive: true });

  // Touch move
  document.addEventListener('touchmove', (e) => {
    if (blocked || startX === null) return;
    
    // Double-check: if we're on page 0, block
    if (getCurrentPageIndex() === 0) {
      blocked = true;
      startX = null;
      startY = null;
      return;
    }

    const dx = e.touches[0].clientX - startX;
    const dy = e.touches[0].clientY - startY;

    // If vertical movement is greater, abort horizontal swipe
    if (!dragging && Math.abs(dy) > Math.abs(dx) && Math.abs(dy) > 10) {
      startX = null;
      startY = null;
      return;
    }

    // Mark as dragging if horizontal movement is significant
    if (Math.abs(dx) > 10) {
      dragging = true;
    }
  }, { passive: true });

  // Touch end
  document.addEventListener('touchend', (e) => {
    if (blocked) {
      blocked = false;
      startX = null;
      startY = null;
      return;
    }

    if (!dragging || startX === null) {
      startX = null;
      startY = null;
      dragging = false;
      return;
    }

    const endX = e.changedTouches[0].clientX;
    const deltaX = startX - endX;
    const currentPage = getCurrentPageIndex();
    const totalPages = PAGES_WRAP.children.length;

    console.log(`TOUCHEND: deltaX=${deltaX}, currentPage=${currentPage}`);

    // Only execute swipe if movement is significant enough
    if (Math.abs(deltaX) > SWIPE_THRESHOLD) {
      if (deltaX > 0 && currentPage < totalPages - 1) {
        // Swipe left - go to next page
        console.log('SWIPING: Next page');
        goToPage(currentPage + 1);
      } else if (deltaX < 0 && currentPage > 0) {
        // Swipe right - go to previous page (INCLUDING back to page 0)
        console.log('SWIPING: Previous page');
        goToPage(currentPage - 1);
      }
    }

    // Reset
    startX = null;
    startY = null;
    dragging = false;
  }, { passive: true });

  // Wheel support for desktop
  let wheelCooldown = 0;
  PAGES_WRAP.addEventListener('wheel', (e) => {
    const currentPage = getCurrentPageIndex();
    
    // Block wheel on page 0
    if (currentPage === 0) {
      console.log('BLOCKED: Wheel navigation disabled on system controls page');
      return;
    }
    
    const now = Date.now();
    if (now < wheelCooldown) return;
    
    const delta = e.deltaY || e.deltaX;
    if (Math.abs(delta) < 10) return;
    
    const totalPages = PAGES_WRAP.children.length;
    
    if (delta > 0 && currentPage < totalPages - 1) {
      goToPage(currentPage + 1);
      wheelCooldown = now + 300;
    } else if (delta < 0 && currentPage > 0) {
      goToPage(currentPage - 1);
      wheelCooldown = now + 300;
    }
  }, { passive: true });
}
