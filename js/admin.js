// ============================================================
// eMatch — js/admin.js
// Self-contained: CSS + HTML + Logic — no admin.html needed
// Usage: <script src="js/admin.js"></script> on any blank page
// ============================================================

(async function () {

  // ── Inject CSS ────────────────────────────────────────
  const style = document.createElement('style');
  style.textContent = `
    :root {
      --admin-gold:   #ffd700;
      --admin-red:    #ef4444;
      --admin-green:  #00e676;
      --admin-blue:   #3b82f6;
      --admin-purple: #a855f7;
    }
    .admin-hero {
      background: linear-gradient(135deg, #0d1117 0%, #1a0a2e 60%, #0d1a2e 100%);
      padding: var(--sp-xl) var(--sp-md) var(--sp-md);
      position: relative; overflow: hidden;
      border-bottom: 1px solid var(--glass-border);
    }
    .admin-hero::before {
      content: ''; position: absolute; inset: 0;
      background:
        radial-gradient(circle at 10% 50%, rgba(168,85,247,.12) 0%, transparent 55%),
        radial-gradient(circle at 90% 30%, rgba(59,130,246,.10) 0%, transparent 55%);
      pointer-events: none;
    }
    .admin-hero-inner {
      position: relative; z-index: 1;
      display: flex; align-items: center; gap: var(--sp-md);
    }
    .admin-shield {
      width: 52px; height: 52px; border-radius: var(--r-md);
      background: linear-gradient(135deg, rgba(168,85,247,.3), rgba(59,130,246,.3));
      border: 1px solid rgba(168,85,247,.4);
      display: flex; align-items: center; justify-content: center;
      font-size: 24px; flex-shrink: 0;
      box-shadow: 0 0 24px rgba(168,85,247,.2);
    }
    .admin-hero h1 {
      font-size: 20px; font-weight: 900;
      background: linear-gradient(135deg, #a855f7, #3b82f6);
      -webkit-background-clip: text; -webkit-text-fill-color: transparent;
      margin-bottom: 2px;
    }
    .admin-hero p { font-size: 12px; color: var(--text-muted); margin: 0; }

    .admin-tabs {
      display: flex; background: var(--bg-card);
      border-bottom: 1px solid var(--glass-border);
      position: sticky; top: 56px; z-index: 80;
      overflow-x: auto; scrollbar-width: none;
    }
    .admin-tabs::-webkit-scrollbar { display: none; }
    .admin-tab {
      flex: 1; min-width: 70px; padding: 12px 8px;
      font-size: 11px; font-weight: 700; color: var(--text-muted);
      text-align: center; cursor: pointer;
      border-bottom: 2px solid transparent;
      transition: all var(--dur-fast) var(--ease);
      white-space: nowrap; user-select: none;
      -webkit-tap-highlight-color: transparent;
    }
    .admin-tab.active { color: var(--admin-purple); border-bottom-color: var(--admin-purple); }
    .admin-tab .tab-icon { font-size: 16px; display: block; margin-bottom: 2px; }
    .admin-tab .tab-badge {
      display: inline-flex; align-items: center; justify-content: center;
      background: var(--admin-red); color: #fff;
      font-size: 9px; font-weight: 800;
      min-width: 16px; height: 16px; border-radius: var(--r-full);
      padding: 0 4px; margin-left: 3px; vertical-align: middle;
    }

    .admin-panel { display: none; }
    .admin-panel.active { display: block; }

    .stats-grid {
      display: grid; grid-template-columns: 1fr 1fr;
      gap: var(--sp-sm); padding: var(--sp-md);
    }
    .stat-card {
      background: var(--bg-card); border: 1px solid var(--glass-border);
      border-radius: var(--r-md); padding: var(--sp-md);
      position: relative; overflow: hidden;
      animation: statIn .4s var(--ease) both;
    }
    .stat-card:nth-child(1){animation-delay:.05s}
    .stat-card:nth-child(2){animation-delay:.10s}
    .stat-card:nth-child(3){animation-delay:.15s}
    .stat-card:nth-child(4){animation-delay:.20s}
    .stat-card:nth-child(5){animation-delay:.25s}
    .stat-card:nth-child(6){animation-delay:.30s}
    @keyframes statIn {
      from { opacity:0; transform:translateY(12px); }
      to   { opacity:1; transform:translateY(0); }
    }
    .stat-card::before {
      content: ''; position: absolute; top: 0; left: 0; right: 0; height: 2px;
    }
    .stat-card.gold::before   { background: linear-gradient(90deg,var(--admin-gold),transparent); }
    .stat-card.green::before  { background: linear-gradient(90deg,var(--admin-green),transparent); }
    .stat-card.blue::before   { background: linear-gradient(90deg,var(--admin-blue),transparent); }
    .stat-card.red::before    { background: linear-gradient(90deg,var(--admin-red),transparent); }
    .stat-card.purple::before { background: linear-gradient(90deg,var(--admin-purple),transparent); }
    .stat-icon  { font-size: 22px; margin-bottom: var(--sp-sm); display: block; }
    .stat-value { font-size: 24px; font-weight: 900; line-height: 1; margin-bottom: 4px; }
    .stat-label { font-size: 11px; color: var(--text-muted); }

    .section-hdr {
      display: flex; align-items: center; justify-content: space-between;
      padding: var(--sp-md) var(--sp-md) var(--sp-sm);
    }
    .section-hdr h2 { font-size: 14px; font-weight: 800; }
    .section-hdr .count-badge {
      font-size: 11px; font-weight: 700; background: var(--bg-card2);
      border: 1px solid var(--border); padding: 2px 8px;
      border-radius: var(--r-full); color: var(--text-muted);
    }
    .refresh-btn {
      background: none; border: none; color: var(--text-muted);
      cursor: pointer; padding: 4px; border-radius: var(--r-sm);
    }
    .refresh-btn:active { color: var(--admin-purple); }

    .admin-filter-row {
      display: flex; gap: var(--sp-sm); padding: 0 var(--sp-md) var(--sp-sm);
      overflow-x: auto; scrollbar-width: none;
    }
    .admin-filter-row::-webkit-scrollbar { display: none; }
    .admin-chip {
      flex-shrink: 0; font-size: 11px; font-weight: 700;
      padding: 5px 12px; border-radius: var(--r-full);
      background: var(--bg-card2); border: 1px solid var(--border);
      color: var(--text-muted); cursor: pointer;
      transition: all var(--dur-fast) var(--ease);
    }
    .admin-chip.active {
      background: rgba(168,85,247,.15);
      border-color: rgba(168,85,247,.4);
      color: var(--admin-purple);
    }

    .dep-card {
      margin: 0 var(--sp-md) var(--sp-sm); background: var(--bg-card);
      border: 1px solid var(--glass-border); border-radius: var(--r-md);
      overflow: hidden; animation: statIn .3s var(--ease) both;
    }
    .dep-card-head {
      display: flex; align-items: center; justify-content: space-between;
      padding: var(--sp-sm) var(--sp-md);
      background: rgba(255,255,255,.02); border-bottom: 1px solid var(--glass-border);
    }
    .dep-card-coins { font-size: 18px; font-weight: 900; color: var(--admin-gold); }
    .dep-card-body  { padding: var(--sp-sm) var(--sp-md); }
    .dep-card-row {
      display: flex; align-items: center; gap: 8px;
      font-size: 12px; color: var(--text-secondary); margin-bottom: 6px;
    }
    .dep-ussd {
      font-family: monospace; font-size: 11px;
      background: var(--bg-card2); border: 1px solid var(--border);
      border-radius: var(--r-sm); padding: 6px 10px;
      color: var(--admin-green); word-break: break-all; margin: var(--sp-sm) 0;
    }
    .dep-actions {
      display: grid; grid-template-columns: 1fr 1fr;
      gap: var(--sp-sm); padding: var(--sp-sm) var(--sp-md) var(--sp-md);
    }

    .match-admin-card {
      margin: 0 var(--sp-md) var(--sp-sm); background: var(--bg-card);
      border: 1px solid var(--glass-border); border-radius: var(--r-md);
      overflow: hidden; animation: statIn .3s var(--ease) both;
    }
    .match-admin-head {
      display: flex; align-items: center; justify-content: space-between;
      padding: var(--sp-sm) var(--sp-md); border-bottom: 1px solid var(--glass-border);
      background: rgba(255,255,255,.02);
    }
    .match-admin-title { font-size: 13px; font-weight: 700; }
    .match-admin-body  { padding: var(--sp-sm) var(--sp-md); }
    .match-admin-prize {
      display: flex; align-items: center; justify-content: space-between;
      font-size: 12px; color: var(--text-secondary); margin-bottom: var(--sp-sm);
    }
    .match-admin-prize span:last-child { font-weight: 800; color: var(--admin-gold); }

    .vs-row {
      display: flex; align-items: center; justify-content: space-between;
      gap: var(--sp-sm); margin-bottom: var(--sp-sm);
    }
    .vs-player {
      flex: 1; background: var(--bg-card2); border: 1px solid var(--border);
      border-radius: var(--r-sm); padding: var(--sp-sm); text-align: center;
      cursor: pointer; transition: all var(--dur-fast) var(--ease);
    }
    .vs-player:active { opacity: .7; }
    .vs-player.selected { border-color: var(--admin-gold); background: rgba(255,215,0,.08); }
    .vs-player-avatar {
      width: 36px; height: 36px; border-radius: 50%;
      display: flex; align-items: center; justify-content: center;
      font-size: 14px; font-weight: 900; color: #000; margin: 0 auto 6px;
    }
    .vs-player-uid { font-size: 10px; color: var(--text-muted); }
    .vs-label { font-size: 13px; font-weight: 900; color: var(--text-muted); }

    .user-card {
      margin: 0 var(--sp-md) var(--sp-sm); background: var(--bg-card);
      border: 1px solid var(--glass-border); border-radius: var(--r-md);
      padding: var(--sp-md); display: flex; align-items: center;
      gap: var(--sp-md); animation: statIn .3s var(--ease) both;
      cursor: pointer; -webkit-tap-highlight-color: transparent;
    }
    .user-card:active { opacity: .8; }
    .user-avatar-lg {
      width: 44px; height: 44px; border-radius: 50%;
      background: linear-gradient(135deg, var(--admin-purple), var(--admin-blue));
      display: flex; align-items: center; justify-content: center;
      font-size: 16px; font-weight: 900; color: #fff; flex-shrink: 0;
    }
    .user-info { flex: 1; min-width: 0; }
    .user-name  {
      font-size: 14px; font-weight: 700;
      white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
    }
    .user-email {
      font-size: 11px; color: var(--text-muted);
      white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
    }
    .user-meta  { display: flex; gap: 6px; margin-top: 4px; }
    .user-coins-tag {
      font-size: 10px; font-weight: 700;
      background: rgba(255,215,0,.1); border: 1px solid rgba(255,215,0,.2);
      color: var(--admin-gold); padding: 1px 6px; border-radius: var(--r-full);
    }
    .user-role-tag  { font-size: 10px; font-weight: 700; padding: 1px 6px; border-radius: var(--r-full); }
    .role-owner         { background:rgba(168,85,247,.12); color:var(--admin-purple); border:1px solid rgba(168,85,247,.25); }
    .role-administrator { background:rgba(59,130,246,.12);  color:var(--admin-blue);   border:1px solid rgba(59,130,246,.25); }
    .role-user          { background:rgba(255,255,255,.05); color:var(--text-muted);   border:1px solid var(--border); }

    .admin-search { margin: var(--sp-md) var(--sp-md) var(--sp-sm); position: relative; }
    .admin-search input {
      width: 100%; background: var(--bg-card); border: 1px solid var(--glass-border);
      border-radius: var(--r-md); padding: 10px 14px 10px 38px;
      font-size: 13px; color: var(--text-primary); font-family: inherit;
    }
    .admin-search-icon {
      position: absolute; left: 12px; top: 50%; transform: translateY(-50%);
      color: var(--text-muted); font-size: 15px; pointer-events: none;
    }

    .admin-empty { text-align: center; padding: 40px var(--sp-md); color: var(--text-muted); }
    .admin-empty .icon { font-size: 40px; margin-bottom: 12px; }
    .admin-empty p { font-size: 13px; }

    .user-detail-row {
      display: flex; align-items: center; justify-content: space-between;
      padding: var(--sp-sm) 0; border-bottom: 1px solid var(--glass-border); font-size: 13px;
    }
    .user-detail-row:last-child { border-bottom: none; }
    .user-detail-label { color: var(--text-muted); }
    .user-detail-value { font-weight: 600; }

    @keyframes livePulse {
      0%,100% { box-shadow: 0 0 0 0 rgba(239,68,68,.4); }
      50%      { box-shadow: 0 0 0 6px rgba(239,68,68,0); }
    }
    .live-dot {
      width: 8px; height: 8px; border-radius: 50%; background: var(--admin-red);
      animation: livePulse 1.5s ease-in-out infinite;
      display: inline-block; margin-right: 4px;
    }

    .back-btn {
      display: flex; align-items: center; gap: 6px;
      background: none; border: none; color: var(--text-secondary);
      font-size: 14px; font-weight: 600; cursor: pointer; padding: 0;
      font-family: inherit;
    }
    .back-btn:active { opacity: .7; }
  `;
  document.head.appendChild(style);
  document.title = 'eMatch — Admin';

  // ── Build full page HTML ──────────────────────────────
  const app = document.getElementById('app') || document.body;
  app.innerHTML = `
    <div id="offline-banner" class="offline-banner hidden" role="alert">
      📵 Internetka kuma xidna
    </div>

    <header class="top-header">
      <button class="back-btn" onclick="history.back()">
        <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20"
          viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
          <polyline points="15 18 9 12 15 6"/>
        </svg>
        Dib
      </button>
      <div style="font-size:15px;font-weight:800">🛡️ Admin</div>
      <div class="coin-chip" onclick="window.location.href='wallet.html'"
        role="button" tabindex="0">
        🪙 <span class="coin-balance-display">—</span>
      </div>
    </header>

    <main class="page-content" role="main">

      <div class="admin-hero">
        <div class="admin-hero-inner">
          <div class="admin-shield">🛡️</div>
          <div>
            <h1>Admin Dashboard</h1>
            <p id="admin-uid-display">Xisaabta admin-ka</p>
          </div>
        </div>
      </div>

      <div class="admin-tabs">
        <div class="admin-tab active" data-tab="stats"    onclick="switchTab('stats')">
          <span class="tab-icon">📊</span>Stats
        </div>
        <div class="admin-tab" data-tab="deposits" onclick="switchTab('deposits')">
          <span class="tab-icon">💰</span>Deposits
          <span class="tab-badge" id="dep-badge" style="display:none">0</span>
        </div>
        <div class="admin-tab" data-tab="matches"  onclick="switchTab('matches')">
          <span class="tab-icon">🎮</span>Matches
        </div>
        <div class="admin-tab" data-tab="users"    onclick="switchTab('users')">
          <span class="tab-icon">👥</span>Users
        </div>
      </div>

      <!-- ── STATS ── -->
      <div class="admin-panel active" id="panel-stats">
        <div class="stats-grid">
          <div class="stat-card gold">
            <span class="stat-icon">🪙</span>
            <div class="stat-value" id="s-total-coins">—</div>
            <div class="stat-label">Coins Oo Dhan</div>
          </div>
          <div class="stat-card blue">
            <span class="stat-icon">👥</span>
            <div class="stat-value" id="s-total-users">—</div>
            <div class="stat-label">Isticmaalayaasha</div>
          </div>
          <div class="stat-card green">
            <span class="stat-icon">🎮</span>
            <div class="stat-value" id="s-total-matches">—</div>
            <div class="stat-label">Matches Oo Dhan</div>
          </div>
          <div class="stat-card red">
            <span class="stat-icon">🔴</span>
            <div class="stat-value" id="s-live-matches">—</div>
            <div class="stat-label">Live Hadda</div>
          </div>
          <div class="stat-card purple">
            <span class="stat-icon">💰</span>
            <div class="stat-value" id="s-pending-deps">—</div>
            <div class="stat-label">Deposits Sugaya</div>
          </div>
          <div class="stat-card gold">
            <span class="stat-icon">🏆</span>
            <div class="stat-value" id="s-total-wins">—</div>
            <div class="stat-label">Guulaha Oo Dhan</div>
          </div>
        </div>
        <div class="section-hdr">
          <h2>⚡ Dhaqdhaqaaqa Dambe</h2>
          <button class="refresh-btn" onclick="loadStats()">
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16"
              viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <polyline points="23 4 23 10 17 10"/>
              <path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"/>
            </svg>
          </button>
        </div>
        <div id="recent-activity" style="padding:0 var(--sp-md) var(--sp-xl)">
          <div class="admin-empty"><div class="icon">⏳</div><p>La soo qaadayaa...</p></div>
        </div>
      </div>

      <!-- ── DEPOSITS ── -->
      <div class="admin-panel" id="panel-deposits">
        <div class="admin-filter-row">
          <div class="admin-chip active" data-depfilter="pending"  onclick="setDepFilter('pending')">⏳ Sugaya</div>
          <div class="admin-chip"        data-depfilter="approved" onclick="setDepFilter('approved')">✅ La Ogolaaday</div>
          <div class="admin-chip"        data-depfilter="rejected" onclick="setDepFilter('rejected')">❌ La Diidey</div>
        </div>
        <div class="section-hdr">
          <h2>💰 Deposit Requests</h2>
          <span class="count-badge" id="dep-count">0</span>
        </div>
        <div id="deposits-list">
          <div class="admin-empty"><div class="icon">⏳</div><p>La soo qaadayaa...</p></div>
        </div>
        <div style="height:var(--sp-xl)"></div>
      </div>

      <!-- ── MATCHES ── -->
      <div class="admin-panel" id="panel-matches">
        <div class="admin-filter-row">
          <div class="admin-chip active" data-matchfilter="locked" onclick="setMatchFilter('locked')">
            <span class="live-dot"></span>Live
          </div>
          <div class="admin-chip" data-matchfilter="open" onclick="setMatchFilter('open')">⏳ Furan</div>
          <div class="admin-chip" data-matchfilter="done" onclick="setMatchFilter('done')">✅ Dhammaaday</div>
        </div>
        <div class="section-hdr">
          <h2>🎮 Matches</h2>
          <span class="count-badge" id="match-count">0</span>
        </div>
        <div id="matches-admin-list">
          <div class="admin-empty"><div class="icon">⏳</div><p>La soo qaadayaa...</p></div>
        </div>
        <div style="height:var(--sp-xl)"></div>
      </div>

      <!-- ── USERS ── -->
      <div class="admin-panel" id="panel-users">
        <div class="admin-search">
          <span class="admin-search-icon">🔍</span>
          <input type="text" id="user-search"
            placeholder="Magac ama email ka raadi..."
            oninput="filterUsers(this.value)">
        </div>
        <div class="section-hdr">
          <h2>👥 Isticmaalayaasha</h2>
          <span class="count-badge" id="user-count">0</span>
        </div>
        <div id="users-list">
          <div class="admin-empty"><div class="icon">⏳</div><p>La soo qaadayaa...</p></div>
        </div>
        <div style="height:var(--sp-xl)"></div>
      </div>

    </main>

    <!-- User Modal -->
    <div class="modal-overlay" id="user-modal">
      <div class="modal-sheet">
        <div class="modal-handle"></div>
        <div id="user-modal-content">
          <div class="skeleton sk-block mb-md"></div>
        </div>
      </div>
    </div>
  `;

  // Modal backdrop close
  document.querySelectorAll('.modal-overlay').forEach(o =>
    o.addEventListener('click', e => {
      if (e.target === o && window.closeModal) closeModal(o.id);
    })
  );

  // ── Wait for app.js ────────────────────────────────────
  function waitFor(fn, ms = 50, tries = 60) {
    return new Promise((res, rej) => {
      let t = 0;
      const iv = setInterval(() => {
        if (fn()) { clearInterval(iv); res(); }
        if (++t >= tries) { clearInterval(iv); rej(); }
      }, ms);
    });
  }

  try {
    await waitFor(() => window._ematch_db && window._ematch_uid);
  } catch { console.error('admin.js: app.js init timeout'); return; }

  const {
    collection, query, where, orderBy, limit,
    getDocs, doc, getDoc, updateDoc, runTransaction, serverTimestamp
  } = await import("https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js");

  const db  = window._ematch_db;
  const uid = window._ematch_uid;

  const uidEl = document.getElementById('admin-uid-display');
  if (uidEl) uidEl.textContent = 'UID: ' + uid.slice(0, 16) + '...';

  let allUsers    = [];
  let depFilter   = 'pending';
  let matchFilter = 'locked';

  const $ = id => document.getElementById(id);

  // ── Tab Switch ─────────────────────────────────────────
  window.switchTab = function (tab) {
    document.querySelectorAll('.admin-tab').forEach(t =>
      t.classList.toggle('active', t.dataset.tab === tab));
    document.querySelectorAll('.admin-panel').forEach(p =>
      p.classList.toggle('active', p.id === 'panel-' + tab));
    ({ stats: loadStats, deposits: loadDeposits,
       matches: loadAdminMatches, users: loadUsers })[tab]?.();
  };

  // ════════════════════════════════════════════════════════
  // STATS
  // ════════════════════════════════════════════════════════
  window.loadStats = async function () {
    try {
      const [usersSnap, matchesSnap, depSnap, txSnap] = await Promise.all([
        getDocs(query(collection(db,'users'), limit(200))),
        getDocs(query(collection(db,'matches'), limit(200))),
        getDocs(query(collection(db,'deposit_requests'), where('status','==','pending'), limit(100))),
        getDocs(query(collection(db,'transactions'), where('type','==','match_win'), limit(200)))
      ]);

      const totalCoins  = usersSnap.docs.map(d=>d.data()).reduce((s,u)=>s+(u.coinBalance||0)+(u.escrowBalance||0),0);
      const liveMatches = matchesSnap.docs.filter(d=>d.data().status==='locked').length;
      const pending     = depSnap.size;

      const badge = $('dep-badge');
      if (badge) { badge.textContent=pending; badge.style.display=pending>0?'inline-flex':'none'; }

      [['s-total-coins',totalCoins.toLocaleString()],
       ['s-total-users',usersSnap.size],
       ['s-total-matches',matchesSnap.size],
       ['s-live-matches',liveMatches],
       ['s-pending-deps',pending],
       ['s-total-wins',txSnap.size]
      ].forEach(([id,v]) => { const el=$(id); if(el) el.textContent=v; });

      const recentSnap = await getDocs(query(collection(db,'transactions'), orderBy('createdAt','desc'), limit(10)));
      const actEl = $('recent-activity');
      if (!actEl) return;
      if (recentSnap.empty) {
        actEl.innerHTML=`<div class="admin-empty"><div class="icon">📭</div><p>Wax dhaqdhaqaaq ah ma jiro</p></div>`;
        return;
      }
      const icons  = {deposit_approved:'💰',escrow_lock:'🔒',match_win:'🏆',match_loss:'💸',send:'📤',receive:'📥'};
      const labels = {deposit_approved:'Deposit la ogolaaday',escrow_lock:'Match escrow',match_win:'Match guul',match_loss:'Match khasaaro',send:'Coins la diray',receive:'Coins la helay'};
      actEl.innerHTML = recentSnap.docs.map(d => {
        const t=d.data(), pos=(t.coins||0)>0;
        const time=t.createdAt?.toDate?t.createdAt.toDate().toLocaleTimeString('so-SO',{hour:'2-digit',minute:'2-digit'}):'—';
        return `<div class="tx-item" style="margin-bottom:var(--sp-sm)">
          <div class="tx-icon">${icons[t.type]||'💫'}</div>
          <div class="tx-info">
            <div class="tx-title">${labels[t.type]||t.type}</div>
            <div class="tx-date">${(t.userId||'').slice(0,10)}... · ${time}</div>
          </div>
          <div class="tx-amount ${pos?'credit':'debit'}">${pos?'+':''}${(t.coins||0).toLocaleString()} 🪙</div>
        </div>`;
      }).join('');
    } catch(err) { console.error('loadStats:',err); }
  };

  // ════════════════════════════════════════════════════════
  // DEPOSITS
  // ════════════════════════════════════════════════════════
  window.setDepFilter = function (f) {
    depFilter = f;
    document.querySelectorAll('[data-depfilter]').forEach(c =>
      c.classList.toggle('active', c.dataset.depfilter === f));
    loadDeposits();
  };

  window.loadDeposits = async function () {
    const list = $('deposits-list');
    if (!list) return;
    list.innerHTML = empty('⏳','La soo qaadayaa...');
    try {
      const snap = await getDocs(query(collection(db,'deposit_requests'),
        where('status','==',depFilter), orderBy('createdAt','desc'), limit(30)));
      const c=$('dep-count'); if(c) c.textContent=snap.size;
      if (depFilter==='pending') {
        const b=$('dep-badge');
        if(b){b.textContent=snap.size;b.style.display=snap.size>0?'inline-flex':'none';}
        const s=$('s-pending-deps'); if(s) s.textContent=snap.size;
      }
      if (snap.empty) { list.innerHTML=empty(depFilter==='pending'?'✅':'📭',depFilter==='pending'?'Pending deposit ma jiro':'Wax la ma helin'); return; }
      list.innerHTML = snap.docs.map(d => {
        const r=d.data();
        const time=r.createdAt?.toDate?r.createdAt.toDate().toLocaleString('so-SO'):'—';
        return `<div class="dep-card">
          <div class="dep-card-head">
            <span class="dep-card-coins">🪙 ${(r.coinsAmount||0).toLocaleString()}</span>
            <span class="status-pill ${r.status==='pending'?'open':r.status==='approved'?'done':'cancelled'}">
              ${r.status==='pending'?'⏳ Sugaya':r.status==='approved'?'✅ Ogol':'❌ Diid'}
            </span>
          </div>
          <div class="dep-card-body">
            <div class="dep-card-row">💵 <strong>$${r.amountUSD}</strong> · ${r.company} · ${r.phoneSentFrom}</div>
            <div class="dep-card-row">👤 <span style="font-family:monospace;font-size:11px">${(r.userId||'').slice(0,20)}...</span></div>
            <div class="dep-card-row">🕐 ${time}</div>
            <div class="dep-ussd">${r.ussdCode||'—'}</div>
          </div>
          ${r.status==='pending'?`<div class="dep-actions">
            <button class="btn btn-primary btn-sm" onclick="approveDeposit('${d.id}','${r.userId}',${r.coinsAmount})">✅ Ogolow</button>
            <button class="btn btn-danger  btn-sm" onclick="rejectDeposit('${d.id}')">❌ Diid</button>
          </div>`:''}
        </div>`;
      }).join('');
    } catch(err) { list.innerHTML=empty('❌',err.message); }
  };

  window.approveDeposit = async function (reqId, userId, coinsAmount) {
    if (!confirm(`✅ Deposit ogolaan?\n🪙 ${coinsAmount.toLocaleString()} coins`)) return;
    try {
      await runTransaction(db, async tx => {
        const rRef=doc(db,'deposit_requests',reqId), uRef=doc(db,'users',userId);
        const [rSnap,uSnap]=await Promise.all([tx.get(rRef),tx.get(uRef)]);
        if (!rSnap.exists()) throw new Error('Request la ma helin');
        if (rSnap.data().status!=='pending') throw new Error('Horey loo xukumay');
        tx.update(rRef,{status:'approved',reviewedBy:uid,reviewedAt:serverTimestamp()});
        tx.update(uRef,{coinBalance:(uSnap.data().coinBalance||0)+coinsAmount});
        tx.set(doc(collection(db,'transactions')),{userId,type:'deposit_approved',coins:coinsAmount,
          relatedMatch:null,createdAt:serverTimestamp(),meta:{reqId,approvedBy:uid}});
      });
      toast('✅ Deposit la ogolaaday!','success');
      loadDeposits(); loadStats();
    } catch(err) { toast('Khalad: '+err.message,'error'); }
  };

  window.rejectDeposit = async function (reqId) {
    if (!confirm('❌ Deposit-kan diidid?')) return;
    try {
      await updateDoc(doc(db,'deposit_requests',reqId),{status:'rejected',reviewedBy:uid,reviewedAt:serverTimestamp()});
      toast('Deposit la diidiy','info');
      loadDeposits();
    } catch(err) { toast('Khalad: '+err.message,'error'); }
  };

  // ════════════════════════════════════════════════════════
  // MATCHES
  // ════════════════════════════════════════════════════════
  window.setMatchFilter = function (f) {
    matchFilter = f;
    document.querySelectorAll('[data-matchfilter]').forEach(c =>
      c.classList.toggle('active', c.dataset.matchfilter === f));
    loadAdminMatches();
  };

  window.loadAdminMatches = async function () {
    const list = $('matches-admin-list');
    if (!list) return;
    list.innerHTML = empty('⏳','La soo qaadayaa...');
    try {
      const snap = await getDocs(query(collection(db,'matches'),
        where('status','==',matchFilter), orderBy('createdAt','desc'), limit(30)));
      const c=$('match-count'); if(c) c.textContent=snap.size;
      if (snap.empty) { list.innerHTML=empty('🎮','Match la ma helin'); return; }
      const em={'FIFA':'⚽','FC Mobile':'⚽','eFootball':'⚽','NBA 2K':'🏀','PUBG':'🔫','Free Fire':'🔫','COD':'🔫'};
      list.innerHTML = snap.docs.map(d => {
        const m=d.data(), emoji=em[m.platform]||'🎮';
        const time=m.createdAt?.toDate?m.createdAt.toDate().toLocaleDateString('so-SO'):'—';
        const isLive=m.status==='locked', isDone=m.status==='done';
        return `<div class="match-admin-card">
          <div class="match-admin-head">
            <span class="match-admin-title">${emoji} ${m.title||m.platform+' Match'}</span>
            <span class="status-pill ${m.status}">${isLive?'🔴 LIVE':isDone?'✅ Done':'⏳ Furan'}</span>
          </div>
          <div class="match-admin-body">
            <div class="match-admin-prize"><span>🏆 Prize Pool</span><span>🪙 ${((m.stakeCoins||0)*2).toLocaleString()}</span></div>
            <div class="match-admin-prize"><span>📅 Taariikhda</span><span style="color:var(--text-muted)">${time}</span></div>
            ${isLive&&m.createdBy&&m.joinedBy?`
              <div style="margin-bottom:var(--sp-sm);font-size:12px;color:var(--text-muted);font-weight:700">🏆 Winner Dooro:</div>
              <div class="vs-row">
                <div class="vs-player" onclick="selectWinner('${d.id}','${m.createdBy}',this)">
                  <div class="vs-player-avatar" style="background:linear-gradient(135deg,var(--admin-green),var(--admin-blue))">${m.createdBy[0].toUpperCase()}</div>
                  <div class="vs-player-uid">${m.createdBy.slice(0,8)}...</div>
                  <div style="font-size:10px;color:var(--text-muted);margin-top:2px">Abuuraha</div>
                </div>
                <div class="vs-label">VS</div>
                <div class="vs-player" onclick="selectWinner('${d.id}','${m.joinedBy}',this)">
                  <div class="vs-player-avatar" style="background:linear-gradient(135deg,var(--admin-red),#dc2626)">${m.joinedBy[0].toUpperCase()}</div>
                  <div class="vs-player-uid">${m.joinedBy.slice(0,8)}...</div>
                  <div style="font-size:10px;color:var(--text-muted);margin-top:2px">Ku biirtay</div>
                </div>
              </div>`:''}
            ${isDone&&m.winnerId?`<div style="background:rgba(255,215,0,.08);border:1px solid rgba(255,215,0,.2);border-radius:var(--r-sm);padding:var(--sp-sm);text-align:center;font-size:12px">🏆 Winner: <strong style="color:var(--admin-gold)">${m.winnerId.slice(0,12)}...</strong></div>`:''}
            ${m.status==='open'?`<div style="background:rgba(255,255,255,.03);border:1px solid var(--border);border-radius:var(--r-sm);padding:var(--sp-sm);text-align:center;font-size:12px;color:var(--text-muted)">⏳ Ciyaartoodaha 2-aad waa la sugayaa</div>`:''}
          </div>
        </div>`;
      }).join('');
    } catch(err) { list.innerHTML=empty('❌',err.message); }
  };

  window.selectWinner = async function (matchId, winnerUid, el) {
    el.closest('.vs-row').querySelectorAll('.vs-player').forEach(p=>p.classList.remove('selected'));
    el.classList.add('selected');
    if (!confirm(`🏆 Winner set garee?\n${winnerUid.slice(0,16)}...`)) { el.classList.remove('selected'); return; }
    try {
      await runTransaction(db, async tx => {
        const mRef=doc(db,'matches',matchId), mSnap=await tx.get(mRef);
        if (!mSnap.exists()) throw new Error('Match la ma helin');
        const m=mSnap.data();
        if (m.status!=='locked') throw new Error('Match locked ma ahan');
        if (m.winnerId)          throw new Error('Winner horey la dejiyay');
        const loserUid=winnerUid===m.createdBy?m.joinedBy:m.createdBy;
        const prize=(m.stakeCoins||0)*2;
        const wRef=doc(db,'users',winnerUid), lRef=doc(db,'users',loserUid);
        const [wSnap,lSnap]=await Promise.all([tx.get(wRef),tx.get(lRef)]);
        tx.update(mRef,{winnerId:winnerUid,status:'done',completedAt:serverTimestamp()});
        tx.update(wRef,{coinBalance:(wSnap.data().coinBalance||0)+prize,escrowBalance:Math.max(0,(wSnap.data().escrowBalance||0)-m.stakeCoins)});
        tx.update(lRef,{escrowBalance:Math.max(0,(lSnap.data().escrowBalance||0)-m.stakeCoins)});
        tx.set(doc(collection(db,'transactions')),{userId:winnerUid,type:'match_win',coins:+prize,relatedMatch:matchId,createdAt:serverTimestamp(),meta:{matchId,loserUid}});
        tx.set(doc(collection(db,'transactions')),{userId:loserUid,type:'match_loss',coins:-m.stakeCoins,relatedMatch:matchId,createdAt:serverTimestamp(),meta:{matchId,winnerUid}});
      });
      toast('🏆 Winner la dejiyay!','success');
      loadAdminMatches(); loadStats();
    } catch(err) { el.classList.remove('selected'); toast('Khalad: '+err.message,'error'); }
  };

  // ════════════════════════════════════════════════════════
  // USERS
  // ════════════════════════════════════════════════════════
  window.loadUsers = async function () {
    const list=$('users-list');
    if (!list) return;
    list.innerHTML=empty('⏳','La soo qaadayaa...');
    try {
      const snap=await getDocs(query(collection(db,'users'),orderBy('coinBalance','desc'),limit(50)));
      allUsers=snap.docs.map(d=>({id:d.id,...d.data()}));
      const c=$('user-count'); if(c) c.textContent=allUsers.length;
      renderUsers(allUsers);
    } catch(err) { list.innerHTML=empty('❌',err.message); }
  };

  function renderUsers(users) {
    const list=$('users-list');
    if (!list) return;
    if (!users.length) { list.innerHTML=empty('👤','Isticmaale la ma helin'); return; }
    list.innerHTML=users.map((u,i)=>{
      const ini=(u.fullName||'U').split(' ').map(w=>w[0]).join('').toUpperCase().slice(0,2);
      const rc=u.role==='owner'?'role-owner':u.role==='administrator'?'role-administrator':'role-user';
      const rl=u.role==='owner'?'👑 Owner':u.role==='administrator'?'🛡️ Admin':u.role==='partner_manager'?'🤝 Partner':'👤 User';
      return `<div class="user-card" onclick="openUserDetail('${u.id}')" style="animation-delay:${i*.04}s">
        <div class="user-avatar-lg">${ini}</div>
        <div class="user-info">
          <div class="user-name">${u.fullName||'—'}</div>
          <div class="user-email">${u.email||'—'}</div>
          <div class="user-meta">
            <span class="user-coins-tag">🪙 ${(u.coinBalance||0).toLocaleString()}</span>
            <span class="user-role-tag ${rc}">${rl}</span>
          </div>
        </div>
        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24"
          fill="none" stroke="var(--text-muted)" stroke-width="2">
          <polyline points="9 18 15 12 9 6"/>
        </svg>
      </div>`;
    }).join('');
  }

  window.filterUsers = function (q) {
    const term=q.toLowerCase().trim();
    const f=term?allUsers.filter(u=>(u.fullName||'').toLowerCase().includes(term)||(u.email||'').toLowerCase().includes(term)||(u.uid||'').toLowerCase().includes(term)):allUsers;
    const c=$('user-count'); if(c) c.textContent=f.length;
    renderUsers(f);
  };

  window.openUserDetail = async function (userId) {
    window.openModal('user-modal');
    const content=$('user-modal-content');
    content.innerHTML=`<div class="skeleton sk-block mb-md"></div><div class="skeleton sk-line"></div>`;
    try {
      const snap=await getDoc(doc(db,'users',userId));
      if (!snap.exists()) { content.innerHTML='<p class="text-muted p-md">User la ma helin</p>'; return; }
      const u=snap.data();
      const ini=(u.fullName||'U').split(' ').map(w=>w[0]).join('').toUpperCase().slice(0,2);
      const rl=u.role==='owner'?'👑 Owner':u.role==='administrator'?'🛡️ Admin':'👤 User';
      const joined=u.createdAt?.toDate?u.createdAt.toDate().toLocaleDateString('so-SO'):'—';
      content.innerHTML=`
        <div class="modal-header">
          <h2>👤 Xisaabta</h2>
          <button class="modal-close" onclick="closeModal('user-modal')">✕</button>
        </div>
        <div style="text-align:center;padding:var(--sp-md) 0">
          <div style="width:64px;height:64px;border-radius:50%;
            background:linear-gradient(135deg,var(--admin-purple),var(--admin-blue));
            display:flex;align-items:center;justify-content:center;
            font-size:24px;font-weight:900;color:#fff;margin:0 auto var(--sp-sm)">${ini}</div>
          <div style="font-size:18px;font-weight:800">${u.fullName||'—'}</div>
          <div style="font-size:12px;color:var(--text-muted)">${rl}</div>
        </div>
        <div style="padding:0 var(--sp-md) var(--sp-md)">
          <div class="user-detail-row"><span class="user-detail-label">Email</span><span class="user-detail-value" style="font-size:12px">${u.email||'—'}</span></div>
          <div class="user-detail-row"><span class="user-detail-label">Telefon</span><span class="user-detail-value">${u.phone||'—'}</span></div>
          <div class="user-detail-row"><span class="user-detail-label">🪙 Coins</span><span class="user-detail-value" style="color:var(--admin-gold)">${(u.coinBalance||0).toLocaleString()}</span></div>
          <div class="user-detail-row"><span class="user-detail-label">🔒 Escrow</span><span class="user-detail-value">${(u.escrowBalance||0).toLocaleString()}</span></div>
          <div class="user-detail-row"><span class="user-detail-label">📅 Galay</span><span class="user-detail-value">${joined}</span></div>
          <div class="user-detail-row"><span class="user-detail-label">UID</span>
            <span class="user-detail-value" style="font-size:10px;font-family:monospace">${(u.uid||userId).slice(0,20)}...</span></div>
        </div>
        <div style="padding:0 var(--sp-md) var(--sp-md);display:flex;flex-direction:column;gap:var(--sp-sm)">
          <div style="font-size:12px;font-weight:700;color:var(--text-muted);margin-bottom:4px">Role Bedel:</div>
          <div style="display:grid;grid-template-columns:1fr 1fr;gap:var(--sp-sm)">
            <button class="btn btn-ghost btn-sm" onclick="setRole('${userId}','user')">👤 User</button>
            <button class="btn btn-ghost btn-sm" onclick="setRole('${userId}','administrator')">🛡️ Admin</button>
          </div>
          <button class="btn btn-danger btn-sm mt-sm"
            onclick="adjustCoins('${userId}',${u.coinBalance||0})">🪙 Coins Bedel</button>
        </div>`;
    } catch(err) { content.innerHTML=`<p class="text-muted p-md">Khalad: ${err.message}</p>`; }
  };

  window.setRole = async function (userId, role) {
    if (!confirm(`Role ku bedel: ${role}?`)) return;
    try {
      await updateDoc(doc(db,'users',userId),{role});
      toast(`✅ Role: ${role}`,'success');
      window.closeModal('user-modal'); loadUsers();
    } catch(err) { toast('Khalad: '+err.message,'error'); }
  };

  window.adjustCoins = async function (userId, current) {
    const input=prompt(`Coins cusub geli (hadda: ${current}):`);
    if (input===null) return;
    const n=parseInt(input);
    if (isNaN(n)||n<0) { toast('Tiro sax ah geli','error'); return; }
    if (!confirm(`Coins ku bedel ${n}?`)) return;
    try {
      await updateDoc(doc(db,'users',userId),{coinBalance:n});
      toast(`✅ Coins: ${n.toLocaleString()}`,'success');
      window.closeModal('user-modal'); loadUsers();
    } catch(err) { toast('Khalad: '+err.message,'error'); }
  };

  // ── Helpers ────────────────────────────────────────────
  function empty(icon, msg) {
    return `<div class="admin-empty"><div class="icon">${icon}</div><p>${msg}</p></div>`;
  }
  function toast(msg, type) {
    if (window.showToast) showToast(msg, type);
  }

  // ── Init ──────────────────────────────────────────────
  loadStats();

})();
