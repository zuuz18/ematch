// ============================================================
// eMatch — js/nav.js
// Pure JS navigation — no inline onclick strings
// ============================================================

(function () {

  const currentPage = window.location.pathname.split('/').pop() || 'dashboard.html';

  const NAV_ITEMS = [
    {
      id:    'home',
      page:  'dashboard.html',
      href:  'dashboard.html',
      label: 'Home',
      icon:  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>
                <polyline points="9 22 9 12 15 12 15 22"/>
              </svg>`
    },
    {
      id:    'matches',
      page:  'matches.html',
      href:  'matches.html',
      label: 'Matches',
      icon:  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <rect x="2" y="3" width="20" height="14" rx="2" ry="2"/>
                <line x1="8" y1="21" x2="16" y2="21"/>
                <line x1="12" y1="17" x2="12" y2="21"/>
              </svg>`
    },
    {
      id:       'create',
      page:     null,
      href:     'dashboard.html',
      label:    'Abuur',
      isCreate: true,
      icon:     `<svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
                  <line x1="12" y1="5" x2="12" y2="19"/>
                  <line x1="5" y1="12" x2="19" y2="12"/>
                </svg>`
    },
    {
      id:    'wallet',
      page:  'wallet.html',
      href:  'wallet.html',
      label: 'Wallet',
      icon:  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M20 12V22H4V12"/>
                <path d="M22 7H2v5h20V7z"/>
                <path d="M12 22V7"/>
                <path d="M12 7H7.5a2.5 2.5 0 0 1 0-5C11 2 12 7 12 7z"/>
                <path d="M12 7h4.5a2.5 2.5 0 0 0 0-5C13 2 12 7 12 7z"/>
              </svg>`
    },
    {
      id:    'profile',
      page:  'profile.html',
      href:  'profile.html',
      label: 'Profile',
      icon:  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/>
                <circle cx="12" cy="7" r="4"/>
              </svg>`
    }
  ];

  // ── Build nav DOM (no innerHTML strings with handlers) ──
  function buildNav() {
    const nav = document.createElement('nav');
    nav.className = 'bottom-nav';
    nav.setAttribute('role', 'navigation');
    nav.setAttribute('aria-label', 'Main navigation');

    NAV_ITEMS.forEach(item => {
      const a = document.createElement('a');
      a.className = 'nav-item';
      a.href = item.href;
      a.setAttribute('aria-label', item.label);

      if (item.isCreate) {
        // ── Create button ──
        a.classList.add('create-btn');

        const wrap = document.createElement('div');
        wrap.className = 'nav-icon-wrap';
        wrap.innerHTML = item.icon;

        const lbl = document.createElement('span');
        lbl.textContent = item.label;

        a.appendChild(wrap);
        a.appendChild(lbl);

        a.addEventListener('click', function (e) {
          e.preventDefault();
          if (currentPage === 'dashboard.html') {
            // Already on dashboard — open modal directly
            if (window.openModal) window.openModal('create-match-modal');
          } else {
            // Signal dashboard to open modal on arrival
            localStorage.setItem('open_create', '1');
            window.location.href = 'dashboard.html';
          }
        });

      } else {
        // ── Regular nav item ──
        const isActive = item.page === currentPage;
        if (isActive) {
          a.classList.add('active');
          a.setAttribute('aria-current', 'page');
        }
        if (item.page) a.dataset.page = item.page;

        a.innerHTML = item.icon;

        const lbl = document.createElement('span');
        lbl.textContent = item.label;
        a.appendChild(lbl);

        a.addEventListener('click', function (e) {
          if (item.page === currentPage) {
            // Same page — refresh instead of navigate
            e.preventDefault();
            if (window._navRefresh) window._navRefresh();
          }
          // Otherwise — let the link navigate normally
        });
      }

      nav.appendChild(a);
    });

    return nav;
  }

  // ── Inject nav into #app ────────────────────────────────
  function injectNav() {
    const existing = document.querySelector('.bottom-nav');
    if (existing) existing.remove();
    const app = document.getElementById('app') || document.body;
    app.appendChild(buildNav());
  }

  // ── Load cached user data into header elements ──────────
  function loadNavCache() {
    try {
      const raw = localStorage.getItem('ematch_user_cache');
      if (!raw) return;
      const data = JSON.parse(raw);
      if (!data) return;

      const sos      = (data.sosBalance || 0).toLocaleString();
      const fullName = data.fullName || data.displayName || 'U';
      const initials = fullName
        .split(' ')
        .filter(Boolean)
        .map(w => w[0])
        .join('')
        .toUpperCase()
        .slice(0, 2) || 'U';

      document.querySelectorAll('.sos-balance-display').forEach(el => {
        el.textContent = sos;
      });
      document.querySelectorAll('.avatar').forEach(el => {
        el.textContent = initials;
      });
    } catch (_) {}
  }

  // ── Public: refresh nav cache (called when balance updates) ──
  window._navRefresh = function () {
    loadNavCache();
    if (window.showToast) showToast('Hadda boggan ayaad ku jirtaa', 'info');
  };

  // ── Init ────────────────────────────────────────────────
  function init() {
    injectNav();
    loadNavCache();
    // Retry a few times for async data load
    setTimeout(loadNavCache, 300);
    setTimeout(loadNavCache, 800);
    setTimeout(loadNavCache, 1500);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

})();
