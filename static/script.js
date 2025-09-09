// static/script.js - paged TileO frontend (8 tiles per page) + token hide/show logic

const PAGES_WRAP = document.getElementById('pagesWrap');
const PAGER = document.getElementById('pager');
const gridPageSize = 8; // tiles per page

// token UI elements
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

// helper to fetch config
async function fetchConfig() {
  try {
    const res = await fetch("/config");
    if (!res.ok) { console.error("config fetch failed", res.status); return []; }
    const json = await res.json();
    // expecting array of items { id, label, icon }
    return Array.isArray(json) ? json : json;
  } catch (e) {
    console.error("fetch config error", e);
    return [];
  }
}

function isImagePath(p) {
  if (!p || typeof p !== "string") return false;
  const lower = p.toLowerCase();
  return lower.endsWith(".png") || lower.endsWith(".jpg") || lower.endsWith(".jpeg") || lower.endsWith(".svg") || lower.startsWith("/static/");
}

// create a tile element
function makeTile(item) {
  const div = document.createElement("div");
  div.className = "tile";

  let iconHTML;
  if (isImagePath(item.icon)) {
    iconHTML = `<img src="${item.icon}" alt="${item.label} icon" class="icon-img" onerror="this.style.display='none'"/>`;
  } else {
    iconHTML = `<div class="icon">${item.icon || item.label?.charAt(0) || "?"}</div>`;
  }

  div.innerHTML = `${iconHTML}
                   <div class="label">${item.label}</div>`;

  div.addEventListener("click", () => launch(item.id));
  return div;
}

// chunk array into pages of size n
function chunkArray(arr, n){
  const out = [];
  for (let i=0; i<arr.length; i+=n) out.push(arr.slice(i,i+n));
  return out;
}

// build pages and pager
function renderPages(items) {
  PAGES_WRAP.innerHTML = "";
  PAGER.innerHTML = "";

  const pages = chunkArray(items, gridPageSize);
  pages.forEach((pageItems, pageIndex) => {
    const pageEl = document.createElement("section");
    pageEl.className = "page";

    const grid = document.createElement("div");
    grid.className = "grid";

    pageItems.forEach(it => grid.appendChild(makeTile(it)));
    pageEl.appendChild(grid);
    PAGES_WRAP.appendChild(pageEl);

    // pager dot
    const dot = document.createElement("button");
    dot.className = "page-dot";
    dot.setAttribute("aria-label", `Go to page ${pageIndex+1}`);
    dot.addEventListener("click", ()=> {
      // scroll to the page
      const offset = pageEl.offsetLeft;
      PAGES_WRAP.scrollTo({ left: offset, behavior: 'smooth' });
      setActiveDot(pageIndex);
    });
    PAGER.appendChild(dot);
  });

  // set first dot active
  setActiveDot(0);

  // Implement truly atomic/discrete scrolling
  let currentPageIndex = 0;
  let isAnimating = false;
  let startX = 0;
  let currentX = 0;
  const SWIPE_THRESHOLD = 50; // minimum swipe distance to trigger page change

  // Disable default scrolling and implement custom page switching
  PAGES_WRAP.addEventListener('wheel', (e) => {
    e.preventDefault();
    if (isAnimating) return;
    
    const delta = e.deltaX || e.deltaY;
    if (Math.abs(delta) > 10) {
      if (delta > 0 && currentPageIndex < pages.length - 1) {
        goToPage(currentPageIndex + 1);
      } else if (delta < 0 && currentPageIndex > 0) {
        goToPage(currentPageIndex - 1);
      }
    }
  }, { passive: false });

  // Touch events for swipe detection
  PAGES_WRAP.addEventListener('touchstart', (e) => {
    if (isAnimating) return;
    startX = e.touches[0].clientX;
    currentX = startX;
  }, { passive: true });

  PAGES_WRAP.addEventListener('touchmove', (e) => {
    if (isAnimating) return;
    currentX = e.touches[0].clientX;
  }, { passive: true });

  PAGES_WRAP.addEventListener('touchend', (e) => {
    if (isAnimating) return;
    
    const diffX = startX - currentX;
    
    if (Math.abs(diffX) > SWIPE_THRESHOLD) {
      if (diffX > 0 && currentPageIndex < pages.length - 1) {
        // Swipe left - go to next page
        goToPage(currentPageIndex + 1);
      } else if (diffX < 0 && currentPageIndex > 0) {
        // Swipe right - go to previous page
        goToPage(currentPageIndex - 1);
      }
    }
  }, { passive: true });

  // Function to go to specific page atomically
  function goToPage(pageIndex) {
    if (pageIndex < 0 || pageIndex >= pages.length || isAnimating) return;
    
    isAnimating = true;
    currentPageIndex = pageIndex;
    
    const targetScrollLeft = pageIndex * PAGES_WRAP.offsetWidth;
    
    PAGES_WRAP.scrollTo({
      left: targetScrollLeft,
      behavior: 'smooth'
    });
    
    setActiveDot(pageIndex);
    
    // Reset animation flag after scroll completes
    setTimeout(() => {
      isAnimating = false;
    }, 500);
  }

  // Initial positioning
  goToPage(0);
}

// set active dot by index
function setActiveDot(idx){
  const dots = Array.from(PAGER.children);
  dots.forEach((d,i)=> d.classList.toggle('active', i===idx));
}

// update active dot depending on nearest page to current scroll position
function updateActiveDotOnScroll(){
  const pages = Array.from(PAGES_WRAP.children);
  if (pages.length===0) return;
  const scrollLeft = PAGES_WRAP.scrollLeft;
  let closest = 0;
  let minDiff = Infinity;
  pages.forEach((p, i) => {
    const diff = Math.abs(p.offsetLeft - scrollLeft);
    if (diff < minDiff) { minDiff = diff; closest = i; }
  });
  setActiveDot(closest);
}

// perform launch (POST)
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

// initial render
(async () => {
  const cfg = await fetchConfig();
  if (!Array.isArray(cfg)) return;
  // ensure consistent order and ids exist
  const items = cfg.map((it, idx) => {
    if (!it.id) it.id = it.label?.toLowerCase().replace(/\s+/g,'-') || `item-${idx}`;
    return it;
  });
  renderPages(items);
})();
