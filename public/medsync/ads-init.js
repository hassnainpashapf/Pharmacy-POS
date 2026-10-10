// Public pages only. Turns the empty ad placeholders into AdSense units and starts the consent loader, but only when a publisher id is set in ads-config.json.
// Without an id nothing from Google is requested and the "Ad choices" link stays hidden.
import { start } from './consent.js';

const ads = window.OPTIX_ADS;
if (ads && /^ca-pub-\d{6,20}$/.test(ads.client || '')) {
  document.querySelectorAll('[data-ad]').forEach((box) => {
    const slot = ads.slots && ads.slots[box.dataset.ad];
    if (!/^\d{6,20}$/.test(slot || '')) return;
    box.innerHTML = '<small>Advertisement</small>';
    const ins = document.createElement('ins');
    ins.className = 'adsbygoogle'; ins.style.display = 'block';
    ins.setAttribute('data-ad-client', ads.client); ins.setAttribute('data-ad-slot', slot);
    ins.setAttribute('data-ad-format', 'auto'); ins.setAttribute('data-full-width-responsive', 'true');
    box.appendChild(ins); box.hidden = false;
  });
  document.querySelectorAll('[data-ad-choices]').forEach((a) => { a.hidden = false; });
  start(ads);
}
