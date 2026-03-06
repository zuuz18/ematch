// ============================================================
// eMatch — js/sos-rate.js
// Somali Shilling (SOS) — 1 USD = 32,000 SOS
// Min stake: 8,000 SOS (≈ $0.25)
// ============================================================
(function () {

  const FALLBACK_RATE = 32000;
  const MIN_SOS       = 8000;

  window._sosRate = FALLBACK_RATE;
  window._sosMin  = MIN_SOS;

  let _svgCounter = 0;

  // ── Number formatter: 8000 → "8 kun", 32000 → "32 kun" ──
  window.sosFormat = function(amount) {
    if (amount === null || amount === undefined) return '0';
    const n = Math.round(amount);
    if (n === 0) return '0';
    if (n >= 1000 && n % 1000 === 0) return (n / 1000) + ' kun';
    if (n >= 1000) return (n / 1000).toFixed(1) + ' kun';
    return n.toLocaleString();
  };

  // ── Live rate fetch ──────────────────────────────────────
  async function fetchRate() {
    try {
      const res  = await fetch('https://v6.exchangerate-api.com/v6/latest/USD');
      const data = await res.json();
      const rate = data.conversion_rates?.SOS;
      if (rate && rate > 1000) {
        window._sosRate    = rate;
        window._sosUpdated = new Date().toLocaleTimeString('en-GB', {hour:'2-digit',minute:'2-digit'});
        updateRateDisplays();
      }
    } catch { /* use fallback */ }
  }

  function updateRateDisplays() {
    document.querySelectorAll('.sos-usd-rate').forEach(el => {
      el.textContent = `$1 = ${window.sosFormat(window._sosRate)} SOS`;
    });
  }

  // ── Safe XML escape ──────────────────────────────────────
  function escapeXML(str) {
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  // ── Coin SVG with amount in corner ──────────────────────
  window.sosCoinSVG = function(size, amount) {
    size   = size   || 40;
    amount = amount !== undefined ? amount : null;

    const uid = ++_svgCounter;

    let label = '';
    if (amount !== null) label = window.sosFormat(amount);
    const safeLabel = escapeXML(label);

    const badgeW = safeLabel.length > 5 ? 44 : 38;
    const badgeX = 100 - badgeW - 2;
    const textX  = badgeX + badgeW / 2;

    return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" width="${size}" height="${size}" style="flex-shrink:0;display:inline-block">
  <defs>
    <radialGradient id="sosBg${uid}" cx="38%" cy="32%" r="70%">
      <stop offset="0%"   stop-color="#ffcc60"/>
      <stop offset="40%"  stop-color="#e07818"/>
      <stop offset="100%" stop-color="#8b3c00"/>
    </radialGradient>
    <radialGradient id="sosIn${uid}" cx="42%" cy="38%" r="62%">
      <stop offset="0%"   stop-color="#a040aa"/>
      <stop offset="100%" stop-color="#4a0a60"/>
    </radialGradient>
    <radialGradient id="sosSh${uid}" cx="32%" cy="28%" r="55%">
      <stop offset="0%"   stop-color="#fff" stop-opacity="0.35"/>
      <stop offset="100%" stop-color="#fff" stop-opacity="0"/>
    </radialGradient>
  </defs>
  <circle cx="50" cy="50" r="48" fill="url(#sosBg${uid})" filter="drop-shadow(0 2px 4px rgba(0,0,0,0.55))"/>
  ${Array.from({length:40},(_,i)=>{const a=(i*9)*Math.PI/180;return `<line x1="${(50+43*Math.cos(a)).toFixed(1)}" y1="${(50+43*Math.sin(a)).toFixed(1)}" x2="${(50+48*Math.cos(a)).toFixed(1)}" y2="${(50+48*Math.sin(a)).toFixed(1)}" stroke="#a05000" stroke-width="0.9" stroke-opacity="0.7"/>`;}).join('')}
  <circle cx="50" cy="50" r="42" fill="none" stroke="#ffd080" stroke-width="0.6" stroke-opacity="0.35"/>
  <circle cx="50" cy="50" r="36" fill="url(#sosIn${uid})"/>
  <circle cx="50" cy="50" r="36" fill="none" stroke="#cc88dd" stroke-width="0.8" stroke-opacity="0.5"/>
  <polygon points="50,21 57,37 74,37 61,47 66,63 50,53 34,63 39,47 26,37 43,37"
    fill="#fff" fill-opacity="0.93" stroke="#ddb0ea" stroke-width="0.4"/>
  <text x="50" y="79" text-anchor="middle"
    font-family="Georgia,'Times New Roman',serif"
    font-weight="900" font-size="10" fill="#ffe0a0" letter-spacing="2">SOS</text>
  <circle cx="50" cy="50" r="48" fill="url(#sosSh${uid})"/>
  ${safeLabel ? `
  <rect x="${badgeX}" y="2" width="${badgeW}" height="17" rx="8" fill="rgba(0,0,0,0.65)"/>
  <text x="${textX}" y="14" text-anchor="middle"
    font-family="'Helvetica Neue',Arial,sans-serif"
    font-weight="900" font-size="9.5" fill="#ffcc50">${safeLabel}</text>
  ` : ''}
</svg>`;
  };

  // ── Static icon (no amount) ──────────────────────────────
  window._sosCoinImg = function(size) {
    return 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(window.sosCoinSVG(size));
  };

  // ── Update header SOS chip — rebuilds chip content fully ─
  window._updateSosChip = function(sosBalance) {
    const rate = window._sosRate;
    const usd  = (sosBalance / rate).toFixed(2);

    document.querySelectorAll('.sos-chip').forEach(chip => {
      chip.innerHTML =
        window.sosCoinSVG(28) +
        `<div style="line-height:1.2;margin-left:2px">` +
          `<div class="sos-chip-amount">${window.sosFormat(sosBalance||0)}<small> SOS</small></div>` +
          `<div class="sos-chip-usd">≈ $${usd}</div>` +
        `</div>`;
    });

    document.querySelectorAll('.sos-balance-display').forEach(el => {
      el.textContent = window.sosFormat(sosBalance||0) + ' SOS';
    });
  };

  // ── Render amount coin (match cards etc) ────────────────
  window.sosCoin = function(amount, size) {
    return window.sosCoinSVG(size||22, amount);
  };

  // ── Init ─────────────────────────────────────────────────
  function init() {
    if (window._sosInitDone) return;
    window._sosInitDone = true;

    const s = document.createElement('style');
    s.textContent = `
      .sos-chip {
        display: flex; align-items: center; gap: 6px;
        background: rgba(224,120,24,0.12);
        border: 1px solid rgba(224,120,24,0.28);
        border-radius: 99px;
        padding: 3px 10px 3px 4px;
        cursor: pointer; user-select: none;
        -webkit-tap-highlight-color: transparent;
      }
      .sos-chip-amount {
        font-size: 13px; font-weight: 800; color: #ffb030;
      }
      .sos-chip-amount small {
        font-size: 9px; font-weight: 600; opacity: 0.65;
      }
      .sos-chip-usd { font-size: 9px; color: rgba(255,176,48,0.55); }
      .sos-balance-display { font-weight: 800; color: #ffb030; }
      .sos-badge {
        display: inline-flex; align-items: center; gap: 4px;
        font-weight: 800; color: #ffb030;
      }
    `;
    document.head.appendChild(s);

    fetchRate();
    setInterval(fetchRate, 60_000);

    document.querySelectorAll('img[src="img/sos-icon.svg"]').forEach(img => {
      img.src = window._sosCoinImg(parseInt(img.width)||32);
    });

    if (window._navSosReady) window._navSosReady();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else { init(); }

})();
