// static/landscape.js
// Try fullscreen + lock orientation on first user gesture and show rotate overlay when in portrait.
// Works best when the site is installed as a PWA. Provides A2HS instructions for iOS/Android.

const OVERLAY_ID = 'rotateOverlay';
const TRY_LOCK_ON_TAP = true;

// Helpers for overlay
const overlay = document.getElementById(OVERLAY_ID);
const tryBtn = document.getElementById('tryFullscreenBtn');
const a2hsBtn = document.getElementById('a2hsBtn');

function showOverlay() { if (overlay) overlay.classList.add('show'); }
function hideOverlay() { if (overlay) overlay.classList.remove('show'); }

function isPortrait() {
  return window.innerHeight > window.innerWidth;
}

async function tryLockAndFullscreen() {
  // Must be called from user gesture
  try {
    if (document.documentElement.requestFullscreen) {
      await document.documentElement.requestFullscreen({ navigationUI: 'hide' }).catch(()=>{});
    } else if (document.documentElement.webkitRequestFullscreen) {
      document.documentElement.webkitRequestFullscreen();
    }
  } catch(e){}

  try {
    if (screen.orientation && screen.orientation.lock) {
      await screen.orientation.lock('landscape').catch(()=>{});
    } else if (screen.lockOrientation) {
      try { screen.lockOrientation('landscape'); } catch(e) {}
    }
  } catch(e){}

  // small delay then update overlay
  setTimeout(()=> {
    if (isPortrait()) showOverlay(); else hideOverlay();
  }, 250);
}

function updateOverlayByOrientation() {
  // show overlay only on small viewports (mobile) and when portrait
  const mobileish = Math.min(window.innerWidth, window.innerHeight) < 900;
  if (mobileish && isPortrait()) showOverlay(); else hideOverlay();
}

// initial state
updateOverlayByOrientation();

// respond to orientation / resize
window.addEventListener('orientationchange', updateOverlayByOrientation);
window.addEventListener('resize', updateOverlayByOrientation);

// try lock+fullscreen on first user tap (gesture requirement)
if (TRY_LOCK_ON_TAP) {
  const gestureHandler = async () => {
    await tryLockAndFullscreen();
    window.removeEventListener('touchstart', gestureHandler, {passive:true});
    window.removeEventListener('click', gestureHandler);
  };
  window.addEventListener('touchstart', gestureHandler, {passive:true});
  window.addEventListener('click', gestureHandler);
}

// Button handlers
if (tryBtn) {
  tryBtn.addEventListener('click', async (e) => {
    e.preventDefault();
    await tryLockAndFullscreen();
  });
}
if (a2hsBtn) {
  a2hsBtn.addEventListener('click', (e) => {
    e.preventDefault();
    alert(
      "Add to Home Screen:\n\n" +
      "Android (Chrome): Menu → Add to Home screen.\n" +
      "iOS (Safari): Share → Add to Home Screen.\n\n" +
      "Then open TileO from your home screen for the best experience."
    );
  });
}

// On iOS, manifest orientation is ignored; show overlay if portrait
const isIOS = /iphone|ipad|ipod/i.test(navigator.userAgent);
if (isIOS && isPortrait()) showOverlay();
