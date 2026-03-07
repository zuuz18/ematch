// ============================================================
// eMatch — js/nav.js
// ============================================================
(function () {

  const currentPage = window.location.pathname.split('/').pop() || 'dashboard.html';

  const NAV_ITEMS = [
    {
      id: 'home', page: 'dashboard.html', href: 'dashboard.html', label: 'Home',
      icon: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>`
    },
    {
      id: 'matches', page: 'matches.html', href: 'matches.html', label: 'Matches',
      icon: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="2" y="3" width="20" height="14" rx="2" ry="2"/><line x1="8" y1="21" x2="16" y2="21"/><line x1="12" y1="17" x2="12" y2="21"/></svg>`
    },
    {
      id: 'create', page: null, href: 'dashboard.html', label: 'Abuur', isCreate: true,
      icon: `<svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>`
    },
    {
      id: 'wallet', page: 'wallet.html', href: 'wallet.html', label: 'Wallet',
      icon: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M20 12V22H4V12"/><path d="M22 7H2v5h20V7z"/><path d="M12 22V7"/><path d="M12 7H7.5a2.5 2.5 0 0 1 0-5C11 2 12 7 12 7z"/><path d="M12 7h4.5a2.5 2.5 0 0 0 0-5C13 2 12 7 12 7z"/></svg>`
    },
    {
      id: 'profile', page: 'profile.html', href: 'profile.html', label: 'Profile',
      icon: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>`
    }
  ];

  // ── Build nav DOM ────────────────────────────────────────
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
          if (window.openModal) {
            window.openModal('create-match-modal');
            if (window.initCreateModal) window.initCreateModal();
          }
        });
      } else {
        const isActive = item.page === currentPage;
        if (isActive) { a.classList.add('active'); a.setAttribute('aria-current', 'page'); }
        if (item.page) a.dataset.page = item.page;
        a.innerHTML = item.icon;
        const lbl = document.createElement('span');
        lbl.textContent = item.label;
        a.appendChild(lbl);
        a.addEventListener('click', function (e) {
          if (item.page === currentPage) {
            e.preventDefault();
            if (window._navRefresh) window._navRefresh();
          }
        });
      }

      nav.appendChild(a);
    });

    return nav;
  }

  // ── Inject nav ───────────────────────────────────────────
  function injectNav() {
    const existing = document.querySelector('.bottom-nav');
    if (existing) existing.remove();
    const app = document.getElementById('app') || document.body;
    app.appendChild(buildNav());
  }

  // ── Core: update all balance spans on the page ───────────
  function renderBalance(sosBalance) {
    // Use _updateSosChip if available (renders SVG coin + USD in .sos-chip)
    if (window._updateSosChip) { window._updateSosChip(sosBalance); return; }
    const fmt = window.sosFormat
      ? window.sosFormat(sosBalance)
      : sosBalance.toLocaleString();

    document.querySelectorAll('.sos-balance-display').forEach(el => {
      el.textContent = fmt + ' SOS';
    });
  }

  // ── Core: update avatar initials ─────────────────────────
  function renderInitials(fullName) {
    const initials = (fullName || 'U')
      .split(' ').filter(Boolean)
      .map(w => w[0]).join('')
      .toUpperCase().slice(0, 2) || 'U';
    document.querySelectorAll('.avatar').forEach(el => {
      el.textContent = initials;
    });
  }

  // ── Refresh from localStorage (instant, before Firebase) ─
  function loadFromCache() {
    try {
      const raw = localStorage.getItem('ematch_user_cache');
      if (!raw) return;
      const data = JSON.parse(raw);
      if (!data) return;
      renderBalance(data.sosBalance || 0);
      renderInitials(data.fullName || data.displayName || '');
    } catch (_) {}
  }

  // ── Refresh from live app data ───────────────────────────
  function loadFromLive() {
    const data = window._ematch_userdata;
    if (!data) return;
    renderBalance(data.sosBalance || 0);
    renderInitials(data.fullName || data.displayName || '');
  }

  // ── Public: called by app.js whenever user data changes ──
  window._navUpdate = function (userData) {
    if (!userData) { loadFromCache(); return; }
    renderBalance(userData.sosBalance || 0);
    renderInitials(userData.fullName || userData.displayName || '');
  };

  // ── Public: called on same-page nav tap ──────────────────
  window._navRefresh = function () {
    loadFromLive() || loadFromCache();
    if (window.showToast) showToast('Hadda boggan ayaad ku jirtaa', 'info');
  };

  // ── Init ─────────────────────────────────────────────────
  function init() {
    injectNav();
    loadFromCache(); // show cached balance instantly

    // Retry after short delays in case Firebase hasn't loaded yet
    setTimeout(function () { loadFromLive() || loadFromCache(); }, 500);
    setTimeout(function () { loadFromLive() || loadFromCache(); }, 1500);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

})();
