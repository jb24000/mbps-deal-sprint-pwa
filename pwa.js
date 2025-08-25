// Register Service Worker from root scope for GH Pages / any host
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    const sw = new URL('service-worker.js', window.location.href).pathname;
    navigator.serviceWorker.register(sw).catch(()=>{});
  });
}

// Install Prompt (Android/Chromium)
let deferredPrompt = null;
const banner = document.getElementById('installBanner');
const installBtn = document.getElementById('installBtn');
const dismissBtn = document.getElementById('dismissInstall');

window.addEventListener('beforeinstallprompt', (e) => {
  e.preventDefault();
  deferredPrompt = e;
  const isStandalone = window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone;
  if (isStandalone) return;
  banner.hidden = false;
});

installBtn?.addEventListener('click', async () => {
  if (!deferredPrompt) return;
  deferredPrompt.prompt();
  await deferredPrompt.userChoice;
  deferredPrompt = null;
  banner.hidden = true;
});

dismissBtn?.addEventListener('click', () => {
  banner.hidden = true;
});
