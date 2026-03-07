// ============================================================
// eMatch — js/admin.js  (v3 — clean, no duplicates)
// ============================================================

(async function () {

  const page = window.location.pathname.split('/').pop() || '';
  if (page !== 'admin.html') return;

  await new Promise(r => setTimeout(r, 100));
  if (!window._ematch_uid && !localStorage.getItem('ematch_user_cache')) return;

  function waitFor(fn, ms=50, tries=60) {
    return new Promise((res,rej) => {
      let t=0;
      const iv=setInterval(()=>{
        if(fn()){clearInterval(iv);res();}
        if(++t>=tries){clearInterval(iv);rej();}
      },ms);
    });
  }

  // Wait for both db+uid AND userdata (so role is available immediately)
  try { await waitFor(()=>window._ematch_db&&window._ematch_uid); }
  catch { console.error('admin.js: app.js init timeout'); return; }

  const {
    collection, query, where, limit,
    getDocs, getDocsFromServer, getDocFromServer,
    doc, getDoc, setDoc, updateDoc, addDoc,
    runTransaction, serverTimestamp, onSnapshot
  } = await import("https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js");

  const db  = window._ematch_db;
  const uid = window._ematch_uid;
  const $   = id => document.getElementById(id);

  const uidEl = $('admin-uid-display');
  if (uidEl) uidEl.textContent = 'UID: ' + uid.slice(0,16) + '...';

  // ── My role + permissions ────────────────────────────────
  let myRole  = 'administrator';
  let myPerms = { stats: true, deposits: true, matches: true }; // defaults

  // First try: use already-loaded userdata (fastest, no extra read)
  const cached = window._ematch_userdata;
  if (cached?.role) {
    myRole = cached.role;
    if (myRole !== 'owner' && cached.adminPerms) {
      myPerms = {
        stats:    cached.adminPerms.stats    !== false,
        deposits: cached.adminPerms.deposits !== false,
        matches:  cached.adminPerms.matches  !== false,
      };
    }
  }

  // Always verify with a fresh Firestore server read (bypass cache + stale localStorage role)
  try {
    const snap = await getDocFromServer(doc(db,'users',uid));
    if (snap.exists()) {
      const d = snap.data();
      myRole  = d.role || myRole;
      if (myRole !== 'owner' && d.adminPerms) {
        myPerms = {
          stats:    d.adminPerms.stats    !== false,
          deposits: d.adminPerms.deposits !== false,
          matches:  d.adminPerms.matches  !== false,
        };
      } else if (myRole === 'owner') {
        myPerms = { stats: true, deposits: true, matches: true };
      }
    }
  } catch(e) {
    console.warn('admin.js: role fetch failed, using cached:', myRole, e.message);
  }

  const ADMIN_ROLES = ['owner','administrator','partner_manager','support','agent'];

  // ── Tab visibility based on permissions ─────────────────
  const tabPerms = { stats: myPerms.stats, deposits: myPerms.deposits, matches: myPerms.matches };

  // Owner: show everything including Users + Games tabs
  // Others: show only permitted tabs
  const ownerOnlyTabs = ['users', 'games'];
  // Remove owner-only class from elements this role can see
  // (CSS hides them by default, JS reveals them by removing class)
  document.querySelectorAll('.admin-tab[data-tab]').forEach(tab => {
    const t = tab.dataset.tab;
    if (ownerOnlyTabs.includes(t)) {
      if (myRole === 'owner') tab.classList.remove('owner-only');
      else tab.style.display = 'none';
    } else if (myRole !== 'owner') {
      if (tabPerms[t] === false) tab.style.display = 'none';
      else tab.style.display = '';
    }
  });
  document.querySelectorAll('.admin-panel[id^="panel-"]').forEach(panel => {
    const t = panel.id.replace('panel-','');
    if (ownerOnlyTabs.includes(t)) {
      if (myRole === 'owner') panel.classList.remove('owner-only');
      else panel.style.display = 'none';
    } else if (myRole !== 'owner') {
      if (tabPerms[t] === false) panel.style.display = 'none';
    }
  });

  // Helper: can current user access this tab?
  function canAccessTab(t) {
    if (t === 'users' || t === 'games') return myRole === 'owner';
    if (myRole === 'owner') return true;
    return tabPerms[t] !== false;
  }

  // Switch to first visible tab (safe fallback)
  const firstVisible = ['stats','deposits','matches','users','games'].find(canAccessTab) || null;
  document.querySelectorAll('.admin-tab').forEach(t => t.classList.remove('active'));
  document.querySelectorAll('.admin-panel').forEach(p => p.classList.remove('active'));
  if (firstVisible) {
    const activeTab   = document.querySelector('.admin-tab[data-tab="' + firstVisible + '"]');
    const activePanel = document.getElementById('panel-' + firstVisible);
    if (activeTab)   activeTab.classList.add('active');
    if (activePanel) activePanel.classList.add('active');
  }

  // ── Shared helpers ──────────────────────────────────────
  let depFilter   = 'pending';
  let matchFilter = 'locked';

  function sortByDate(arr, field='createdAt', desc=true) {
    return arr.sort((a,b) => {
      const aT = a[field]?.toMillis?.() || (a[field]?.seconds||0)*1000;
      const bT = b[field]?.toMillis?.() || (b[field]?.seconds||0)*1000;
      return desc ? bT-aT : aT-bT;
    });
  }

  function empty(icon, msg) {
    return `<div class="admin-empty"><div class="icon">${icon}</div><p>${msg}</p></div>`;
  }

  function toast(msg, type) {
    if (window.showToast) showToast(msg, type);
  }

  // ── Tab switch ──────────────────────────────────────────
  window.switchTab = function(tab) {
    // Block access to tabs without permission
    if (!canAccessTab(tab)) { toast('Fasax kuma lihid tab kan', 'error'); return; }
    document.querySelectorAll('.admin-tab').forEach(t =>
      t.classList.toggle('active', t.dataset.tab===tab));
    document.querySelectorAll('.admin-panel').forEach(p =>
      p.classList.toggle('active', p.id==='panel-'+tab));
    ({stats:loadStats, deposits:loadDeposits, matches:loadAdminMatches, users:loadUsers, games:loadGamesPanel})[tab]?.();
  };

  // ══════════════════════════════════════════════════════════
  // STATS
  // ══════════════════════════════════════════════════════════
  const loadStats = window.loadStats = async function() {
    // ── Fetch each collection individually so one failure doesn't break all ──
    async function safeFetch(q) {
      try { return await getDocs(q); } catch(e) { return { docs:[], size:0, empty:true }; }
    }

    const { getDocsFromServer: gds } = await import('https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js');
    async function safeServerFetch(q) {
      try { return await gds(q); } catch(e) { return { docs:[], size:0, empty:true }; }
    }

    const [usersSnap, matchesSnap, depSnap, txSnap] = await Promise.all([
      safeServerFetch(query(collection(db,'users'), limit(500))),
      safeFetch(query(collection(db,'matches'), limit(200))),
      safeFetch(query(collection(db,'deposit_requests'), where('status','==','pending'), limit(100))),
      safeFetch(query(collection(db,'transactions'), where('type','==','match_win'), limit(200)))
    ]);

    const totalCoins  = usersSnap.docs.reduce((s,d)=>s+(d.data().sosBalance||0)+(d.data().escrowSOS||0),0);
    const liveMatches = matchesSnap.docs.filter(d=>d.data().status==='locked').length;
    const pending     = depSnap.size;

    const badge=$('dep-badge');
    if(badge){badge.textContent=pending;badge.style.display=pending>0?'inline-flex':'none';}

    [['s-total-coins',totalCoins.toLocaleString()],['s-total-users',usersSnap.size],
     ['s-total-matches',matchesSnap.size],['s-live-matches',liveMatches],
     ['s-pending-deps',pending],['s-total-wins',txSnap.size]
    ].forEach(([id,v])=>{const el=$(id);if(el)el.textContent=v;});

    // ── Recent activity ──
    const recentSnap = await safeFetch(query(collection(db,'transactions'), limit(50)));
    const actEl = $('recent-activity');
    if(!actEl) return;
    if(recentSnap.empty){actEl.innerHTML=empty('📭','Wax dhaqdhaqaaq ah ma jiro');return;}
    const recent = sortByDate(recentSnap.docs.map(d=>d.data())).slice(0,10);
    const icons  = {deposit_approved:'💰',escrow_lock:'🔒',match_win:'🏆',match_loss:'💸',send:'📤',receive:'📥',admin_credit:'⚡',admin_debit:'🔧'};
    const labels = {deposit_approved:'Deposit la ogolaaday',escrow_lock:'Match escrow',match_win:'Match guul',match_loss:'Match khasaaro',send:'Coins la diray',receive:'Coins la helay',admin_credit:'Admin Credit',admin_debit:'Admin Debit'};
    actEl.innerHTML = recent.map(t => {
      const pos=(t.sos||0)>0;
      const time=t.createdAt?.toDate?t.createdAt.toDate().toLocaleTimeString('so-SO',{hour:'2-digit',minute:'2-digit'}):'—';
      return `<div class="tx-item" style="margin-bottom:var(--sp-sm)">
        <div class="tx-icon">${icons[t.type]||'💫'}</div>
        <div class="tx-info"><div class="tx-title">${labels[t.type]||t.type}</div><div class="tx-date">${(t.userId||'').slice(0,10)}... · ${time}</div></div>
        <div class="tx-amount ${pos?'credit':'debit'}">${pos?'+':''}${(t.sos||0).toLocaleString()} </div>
      </div>`;
    }).join('');
  };

  // ══════════════════════════════════════════════════════════
  // DEPOSITS
  // ══════════════════════════════════════════════════════════
  window.setDepFilter = function(f) {
    depFilter=f;
    document.querySelectorAll('[data-depfilter]').forEach(c=>c.classList.toggle('active',c.dataset.depfilter===f));
    loadDeposits();
  };

  const loadDeposits = window.loadDeposits = async function() {
    const list=$('deposits-list'); if(!list) return;
    list.innerHTML=empty('⏳','La soo qaadayaa...');
    try {
      const snap=await getDocs(query(collection(db,'deposit_requests'),where('status','==',depFilter),limit(50)));
      const docs=sortByDate(snap.docs.map(d=>({id:d.id,...d.data()})));
      const c=$('dep-count'); if(c) c.textContent=docs.length;
      if(depFilter==='pending'){
        const b=$('dep-badge'); if(b){b.textContent=docs.length;b.style.display=docs.length>0?'inline-flex':'none';}
        const s=$('s-pending-deps'); if(s) s.textContent=docs.length;
      }
      if(!docs.length){list.innerHTML=empty(depFilter==='pending'?'✅':'📭',depFilter==='pending'?'Pending deposit ma jiro':'Wax la ma helin');return;}
      list.innerHTML=docs.map(r=>{
        const time=r.createdAt?.toDate?r.createdAt.toDate().toLocaleString('so-SO'):'—';
        return `<div class="dep-card">
          <div class="dep-card-head">
            <span class="dep-card-coins"> ${(r.sosAmount||0).toLocaleString()}</span>
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
            <button class="btn btn-primary btn-sm" onclick="approveDeposit('${r.id}','${r.userId}',${r.sosAmount})">✅ Ogolow</button>
            <button class="btn btn-danger btn-sm" onclick="rejectDeposit('${r.id}')">❌ Diid</button>
          </div>`:''}
        </div>`;
      }).join('');
    } catch(err){list.innerHTML=empty('❌',err.message);}
  };

  window.approveDeposit = async function(reqId,userId,sosAmount) {
    if(!confirm(`✅ Deposit ogolaan?\n ${sosAmount.toLocaleString()} SOS`)) return;
    try {
      await runTransaction(db, async tx=>{
        const rRef=doc(db,'deposit_requests',reqId), uRef=doc(db,'users',userId);
        const [rSnap,uSnap]=await Promise.all([tx.get(rRef),tx.get(uRef)]);
        if(!rSnap.exists()) throw new Error('Request la ma helin');
        if(rSnap.data().status!=='pending') throw new Error('Horey loo xukumay');
        tx.update(rRef,{status:'approved',reviewedBy:uid,reviewedAt:serverTimestamp()});
        tx.update(uRef,{sosBalance:(uSnap.data().sosBalance||0)+sosAmount});
        tx.set(doc(collection(db,'transactions')),{userId,type:'deposit_approved',sos:sosAmount,relatedMatch:null,createdAt:serverTimestamp(),meta:{reqId,approvedBy:uid}});
      });
      toast('✅ Deposit la ogolaaday!','success');
      loadDeposits(); loadStats();
    } catch(err){toast('Khalad: '+err.message,'error');}
  };

  window.rejectDeposit = async function(reqId) {
    if(!confirm('❌ Deposit-kan diidid?')) return;
    try {
      await updateDoc(doc(db,'deposit_requests',reqId),{status:'rejected',reviewedBy:uid,reviewedAt:serverTimestamp()});
      toast('Deposit la diidiy','info');
      loadDeposits();
    } catch(err){toast('Khalad: '+err.message,'error');}
  };

  // ══════════════════════════════════════════════════════════
  // MATCHES
  // ══════════════════════════════════════════════════════════
  window.setMatchFilter = function(f) {
    matchFilter=f;
    document.querySelectorAll('[data-matchfilter]').forEach(c=>c.classList.toggle('active',c.dataset.matchfilter===f));
    loadAdminMatches();
  };

  const loadAdminMatches = window.loadAdminMatches = async function() {
    const list=$('matches-admin-list'); if(!list) return;
    list.innerHTML=empty('⏳','La soo qaadayaa...');
    try {
      const snap=await getDocs(query(collection(db,'matches'),where('status','==',matchFilter),limit(50)));
      const docs=sortByDate(snap.docs.map(d=>({id:d.id,...d.data()})));
      const c=$('match-count'); if(c) c.textContent=docs.length;
      if(!docs.length){list.innerHTML=empty('🎮','Match la ma helin');return;}
      const em={'FIFA':'⚽','FC Mobile':'⚽','eFootball':'⚽','NBA 2K':'🏀','PUBG':'🔫','Free Fire':'🔫','COD':'🔫'};
      list.innerHTML=docs.map(m=>{
        const emoji=em[m.platform]||'🎮';
        const time=m.createdAt?.toDate?m.createdAt.toDate().toLocaleDateString('so-SO'):'—';
        const isLive=m.status==='locked', isDone=m.status==='done', isDispute=m.status==='dispute';
        return `<div class="match-admin-card">
          <div class="match-admin-head">
            <span class="match-admin-title">${emoji} ${m.title||m.platform+' Match'}</span>
            <span class="status-pill ${m.status}">${isLive?'🔴 LIVE':isDone?'✅ Done':isDispute?'⚠️ Dispute':'⏳ Furan'}</span>
          </div>
          <div class="match-admin-body">
            <div class="match-admin-prize"><span>🏆 Prize Pool</span><span> ${((m.stakeAmount||0)*2).toLocaleString()}</span></div>
            <div class="match-admin-prize"><span>📅 Taariikhda</span><span style="color:var(--text-muted)">${time}</span></div>
            ${(isLive||isDispute)&&m.createdBy&&m.joinedBy?`
              ${isDispute?`<div style="background:rgba(239,68,68,.08);border:1px solid rgba(239,68,68,.3);border-radius:var(--r-sm);padding:var(--sp-sm);margin-bottom:var(--sp-sm)">
                <div style="font-size:12px;font-weight:700;color:#ef4444;margin-bottom:4px">⚠️ Khilaaf — Admin go'aan qaado</div>
                <div style="font-size:11px;color:var(--text-muted);margin-bottom:4px">P1: ${m.createdByUsername||m.createdBy.slice(0,8)+'...'} | P2: ${m.joinedByUsername||m.joinedBy.slice(0,8)+'...'}</div>
                ${m.result?.screenshotUrl?`
                <a href="${m.result.screenshotUrl}" target="_blank" style="display:block;margin-top:4px">
                  <img src="${m.result.screenshotUrl}" alt="Screenshot"
                    style="width:100%;max-height:140px;object-fit:cover;border-radius:6px;border:1px solid rgba(239,68,68,.3);cursor:pointer">
                  <div style="font-size:10px;color:var(--text-muted);margin-top:2px">📸 Screenshot fur</div>
                </a>`:'<div style="font-size:10px;color:var(--text-muted)">📸 Screenshot la ma gelin</div>'}
                ${m.result?.aiResult?`<div style="font-size:10px;color:var(--text-muted);margin-top:4px">
                  🤖 AI: ${m.result.aiResult.winner||'?'} · confidence: ${m.result.aiResult.confidence||'?'}
                </div>`:''}
              </div>`:'<div style="font-size:12px;color:var(--text-muted);font-weight:700;margin-bottom:var(--sp-sm)">🏆 Winner Dooro:</div>'}
              <div class="vs-row">
                <div class="vs-player" onclick="selectWinner('${m.id}','${m.createdBy}',this)">
                  <div class="vs-player-avatar" style="background:linear-gradient(135deg,var(--admin-green),var(--admin-blue))">${m.createdBy[0].toUpperCase()}</div>
                  <div class="vs-player-uid">${m.createdByUsername||m.createdBy.slice(0,8)+'...'}</div>
                  <div style="font-size:10px;color:var(--text-muted);margin-top:2px">Abuuraha</div>
                </div>
                <div class="vs-label">VS</div>
                <div class="vs-player" onclick="selectWinner('${m.id}','${m.joinedBy}',this)">
                  <div class="vs-player-avatar" style="background:linear-gradient(135deg,var(--admin-red),#dc2626)">${m.joinedBy[0].toUpperCase()}</div>
                  <div class="vs-player-uid">${m.joinedByUsername||m.joinedBy.slice(0,8)+'...'}</div>
                  <div style="font-size:10px;color:var(--text-muted);margin-top:2px">Ku biirtay</div>
                </div>
              </div>`:''}
            ${isDone&&m.winnerId?`<div style="background:rgba(255,215,0,.08);border:1px solid rgba(255,215,0,.2);border-radius:var(--r-sm);padding:var(--sp-sm);text-align:center;font-size:12px">🏆 Winner: <strong style="color:var(--admin-gold)">${m.winnerId.slice(0,12)}...</strong></div>`:''}
            ${m.status==='open'?`<div style="background:rgba(255,255,255,.03);border:1px solid var(--border);border-radius:var(--r-sm);padding:var(--sp-sm);text-align:center;font-size:12px;color:var(--text-muted)">⏳ Ciyaartoodaha 2-aad waa la sugayaa</div>`:''}
          </div>
        </div>`;
      }).join('');
    } catch(err){list.innerHTML=empty('❌',err.message);}
  };

  window.selectWinner = async function(matchId,winnerUid,el) {
    el.closest('.vs-row').querySelectorAll('.vs-player').forEach(p=>p.classList.remove('selected'));
    el.classList.add('selected');
    if(!confirm(`🏆 Winner set garee?\n${winnerUid.slice(0,16)}...`)){el.classList.remove('selected');return;}
    try {
      await runTransaction(db, async tx=>{
        const mRef=doc(db,'matches',matchId), mSnap=await tx.get(mRef);
        if(!mSnap.exists()) throw new Error('Match la ma helin');
        const m=mSnap.data();
        if(m.status!=='locked'&&m.status!=='dispute') throw new Error('Match active ma ahan');
        if(m.winnerId) throw new Error('Winner horey la dejiyay');
        const loserUid=winnerUid===m.createdBy?m.joinedBy:m.createdBy;
        const prize=(m.stakeAmount||0)*2;
        const wRef=doc(db,'users',winnerUid), lRef=doc(db,'users',loserUid);
        const [wSnap,lSnap]=await Promise.all([tx.get(wRef),tx.get(lRef)]);
        tx.update(mRef,{winnerId:winnerUid,status:'done',completedAt:serverTimestamp()});
        tx.update(wRef,{sosBalance:(wSnap.data().sosBalance||0)+prize,escrowSOS:Math.max(0,(wSnap.data().escrowSOS||0)-m.stakeAmount)});
        tx.update(lRef,{escrowSOS:Math.max(0,(lSnap.data().escrowSOS||0)-m.stakeAmount)});
        tx.set(doc(collection(db,'transactions')),{userId:winnerUid,type:'match_win',sos:+prize,relatedMatch:matchId,createdAt:serverTimestamp(),meta:{matchId,loserUid}});
        tx.set(doc(collection(db,'transactions')),{userId:loserUid,type:'match_loss',sos:-m.stakeAmount,relatedMatch:matchId,createdAt:serverTimestamp(),meta:{matchId,winnerUid}});
      });
      toast('🏆 Winner la dejiyay!','success');
      loadAdminMatches(); loadStats();
    } catch(err){el.classList.remove('selected');toast('Khalad: '+err.message,'error');}
  };

  // ══════════════════════════════════════════════════════════
  // USERS — real-time, full management
  // ══════════════════════════════════════════════════════════
  let allUsers   = [];
  let usersUnsub = null;
  let userFilter = 'all';
  let userSearch = '';

  function isOnline(u) {
    const ms = u.lastSeen?.toMillis?.() || ((u.lastSeen?.seconds||0)*1000);
    return ms && (Date.now()-ms) < 3*60*1000;
  }

  function getFilteredUsers() {
    let list = [...allUsers];
    if (userFilter==='online')    list = list.filter(isOnline);
    if (userFilter==='admins')    list = list.filter(u=>ADMIN_ROLES.includes(u.role));
    if (userFilter==='highbal')   list = [...list].sort((a,b)=>(b.sosBalance||0)-(a.sosBalance||0));
    if (userFilter==='new')       { const wk=Date.now()-7*24*3600*1000; list=list.filter(u=>((u.createdAt?.toMillis?.()|(u.createdAt?.seconds*1000)||0))>wk); }
    if (userFilter==='suspended') list = list.filter(u=>u.role==='suspended');
    if (userSearch) {
      const t=userSearch;
      list=list.filter(u=>(u.fullName||'').toLowerCase().includes(t)||(u.email||'').toLowerCase().includes(t)||(u.id||'').toLowerCase().includes(t)||(u.phone||'').includes(t));
    }
    if (userFilter!=='highbal') {
      list.sort((a,b)=>{
        const ao=isOnline(a)?1:0, bo=isOnline(b)?1:0;
        if(ao!==bo) return bo-ao;
        const at=a.createdAt?.toMillis?.()|(a.createdAt?.seconds*1000)||0;
        const bt=b.createdAt?.toMillis?.()|(b.createdAt?.seconds*1000)||0;
        return bt-at;
      });
    }
    return list;
  }

  function updateUserStatsBanner() {
    const online = allUsers.filter(isOnline).length;
    const totSOS = allUsers.reduce((s,u)=>s+(u.sosBalance||0),0);
    const admins = allUsers.filter(u=>ADMIN_ROLES.includes(u.role)).length;
    [['um-total',allUsers.length],['um-online',online],
     ['um-sos', totSOS>999999?(totSOS/1000000).toFixed(1)+'M':totSOS>999?Math.round(totSOS/1000)+'K':totSOS],
     ['um-admins',admins],['ufc-all',allUsers.length],['ufc-online',online],['ufc-admins',admins]
    ].forEach(([id,v])=>{const el=$(id);if(el)el.textContent=v;});
    const ub=$('users-badge');
    if(ub){ub.textContent=online;ub.style.display=online>0?'inline-flex':'none';}
  }

  function umTag(u) {
    if(u.role==='owner')           return `<span class="um-tag um-tag-owner">👑 Owner</span>`;
    if(u.role==='administrator')   return `<span class="um-tag um-tag-admin">🛡️ Admin</span>`;
    if(u.role==='partner_manager') return `<span class="um-tag um-tag-sup">🤝 Partner</span>`;
    if(u.role==='support')         return `<span class="um-tag um-tag-sup">🎧 Support</span>`;
    if(u.role==='agent')           return `<span class="um-tag um-tag-sup">📋 Agent</span>`;
    if(u.role==='suspended')       return `<span class="um-tag um-tag-sus">🚫 Suspended</span>`;
    return `<span class="um-tag um-tag-user">👤 User</span>`;
  }

  function renderUsers(users) {
    const listEl=$('users-list'); if(!listEl) return;
    const cnt=$('user-count'); if(cnt) cnt.textContent=users.length;
    if(!users.length){
      listEl.innerHTML=empty(userSearch?'🔍':'👤',userSearch?'User la ma helin':'Isticmaale ma jiro');
      return;
    }
    const fmt=window.sosFormat||(n=>n.toLocaleString());
    listEl.innerHTML=users.map((u,i)=>{
      const ini=(u.fullName||'U').split(' ').filter(Boolean).map(w=>w[0]).join('').toUpperCase().slice(0,2);
      const online=isOnline(u);
      const avBg=u.role==='owner'
        ?'linear-gradient(135deg,#ffd700,#ff6b00)'
        :ADMIN_ROLES.includes(u.role)
          ?'linear-gradient(135deg,var(--admin-purple),var(--admin-blue))'
          :'linear-gradient(135deg,#374151,#1f2937)';
      const avContent = u.photoURL
        ? `<img src="${u.photoURL}" alt="${ini}" style="width:100%;height:100%;object-fit:cover;border-radius:50%">`
        : ini;
      return `<div class="um-user-card" style="animation:statIn .2s var(--ease) ${Math.min(i*.03,.4)}s both" onclick="openUserDetail('${u.id}')">
        <div class="um-avatar" style="background:${u.photoURL?'transparent':avBg}">${avContent}${online?'<div class="um-online-pip"></div>':''}</div>
        <div class="um-info">
          <div class="um-name">${u.fullName||'—'}</div>
          <div class="um-email">${u.email||u.phone||(u.id||'').slice(0,20)+'...'}</div>
          <div class="um-tags">${umTag(u)}<span class="um-tag um-tag-sos">${fmt(u.sosBalance||0)} SOS</span>${online?'<span style="font-size:9px;color:var(--admin-green);font-weight:700;margin-left:2px">● online</span>':''}</div>
        </div>
        <svg xmlns="http://www.w3.org/2000/svg" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="var(--text-muted)" stroke-width="2"><polyline points="9 18 15 12 9 6"/></svg>
      </div>`;
    }).join('');
  }

  window.setUserFilter = function(f, el) {
    userFilter=f;
    document.querySelectorAll('[data-ufilter]').forEach(c=>c.classList.toggle('active',c===el));
    renderUsers(getFilteredUsers());
  };

  window.filterUsers = function(q) {
    userSearch=q.toLowerCase().trim();
    const cl=$('um-clear-btn'); if(cl) cl.style.display=userSearch?'block':'none';
    renderUsers(getFilteredUsers());
  };

  window.clearUserSearch = function() {
    const inp=$('user-search'), cl=$('um-clear-btn');
    if(inp) inp.value=''; if(cl) cl.style.display='none';
    userSearch=''; renderUsers(getFilteredUsers());
  };

  const loadUsers = window.loadUsers = async function() {
    const listEl=$('users-list'); if(!listEl) return;
    if(usersUnsub){usersUnsub();usersUnsub=null;}
    const ri=$('um-refresh-icon');
    if(ri){ri.style.animation='udSpin .7s linear';setTimeout(()=>ri.style.animation='',800);}
    listEl.innerHTML=empty('⏳','La soo qaadayaa...');
    try {
      // Force server fetch first (bypass cache)
      const { getDocsFromServer } = await import('https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js');
      const snap = await getDocsFromServer(query(collection(db,'users'),limit(500)));
      allUsers = snap.docs.map(d=>({id:d.id,...d.data()}));
      updateUserStatsBanner();
      renderUsers(getFilteredUsers());
      // Then subscribe for live updates
      usersUnsub = onSnapshot(
        query(collection(db,'users'),limit(500)),
        s=>{
          allUsers=s.docs.map(d=>({id:d.id,...d.data()}));
          updateUserStatsBanner();
          renderUsers(getFilteredUsers());
        },
        err=>{ if(listEl) listEl.innerHTML=empty('❌',err.message); }
      );
    } catch(err) {
      if(listEl) listEl.innerHTML=empty('❌',err.message);
    }
  };

  // ── User detail bottom sheet ─────────────────────────────
  window.openUserDetail = async function(userId) {
    const overlay=$('ud-overlay'), body=$('ud-body');
    if(!overlay||!body) return;
    body.innerHTML=`<div style="padding:48px;text-align:center;color:var(--text-muted)">⏳</div>`;
    overlay.classList.add('open');
    document.body.style.overflow='hidden';
    try {
      const [uSnap,txSnap]=await Promise.all([
        getDoc(doc(db,'users',userId)),
        getDocs(query(collection(db,'transactions'),where('userId','==',userId),limit(50)))
      ]);
      if(!uSnap.exists()){body.innerHTML='<p style="padding:var(--sp-md)">User la ma helin</p>';return;}
      const u={id:userId,...uSnap.data()};
      const ini=(u.fullName||'U').split(' ').filter(Boolean).map(w=>w[0]).join('').toUpperCase().slice(0,2);
      const online=isOnline(u);
      const joined=u.createdAt?.toDate?u.createdAt.toDate().toLocaleDateString('so-SO'):'—';
      const seenMs=(u.lastSeen?.toMillis?.())||((u.lastSeen?.seconds||0)*1000);
      const lastSeen=seenMs?new Date(seenMs).toLocaleString('so-SO'):'—';
      const wins=txSnap.docs.filter(d=>d.data().type==='match_win').length;
      const txDocs=[...txSnap.docs].sort((a,b)=>{
        const at=a.data().createdAt?.toMillis?.()||(a.data().createdAt?.seconds||0)*1000;
        const bt=b.data().createdAt?.toMillis?.()||(b.data().createdAt?.seconds||0)*1000;
        return bt-at;
      }).slice(0,10);
      const fmt=window.sosFormat||(n=>n.toLocaleString());

      const availRoles=myRole==='owner'
        ?[['user','👤 User',''],['support','🎧 Support',''],['agent','📋 Agent',''],['partner_manager','🤝 Partner',''],['administrator','🛡️ Admin',''],['owner','👑 Owner','owner-p'],['suspended','🚫 Suspend','sus-p']]
        :[['user','👤 User',''],['support','🎧 Support',''],['agent','📋 Agent',''],['suspended','🚫 Suspend','sus-p']];

      const rolePills=availRoles.map(([r,lbl,xc])=>
        `<button class="ud-role-pill ${xc} ${u.role===r?'cur':''}" onclick="udSetRole('${userId}','${r}','${lbl}')">${lbl}</button>`
      ).join('');

      const txIcons={deposit_approved:'💰',escrow_lock:'🔒',match_win:'🏆',match_loss:'💸',send:'📤',receive:'📥',admin_credit:'⚡',admin_debit:'🔧'};
      const txLabels={deposit_approved:'Deposit',escrow_lock:'Escrow',match_win:'Guul',match_loss:'Khasaaro',send:'La diray',receive:'La helay',admin_credit:'Admin+',admin_debit:'Admin−'};
      const txHtml=txDocs.length
        ?txDocs.map(d=>{
            const t=d.data(),cr=(t.sos||0)>0,dt=t.createdAt?.toDate?t.createdAt.toDate().toLocaleDateString('so-SO'):'—';
            return `<div class="ud-tx-mini"><div class="ud-tx-icon">${txIcons[t.type]||'💫'}</div><div class="ud-tx-info"><div class="ud-tx-lbl">${txLabels[t.type]||t.type}</div><div class="ud-tx-date">${dt}</div></div><div class="ud-tx-amt ${cr?'cr':'dr'}">${cr?'+':''}${fmt(t.sos||0)}</div></div>`;
          }).join('')
        :`<div style="padding:14px;text-align:center;color:var(--text-muted);font-size:12px">Wax transaction ah ma jiro</div>`;

      const avBg=u.role==='owner'
        ?'background:linear-gradient(135deg,#ffd700,#ff6b00);color:#000'
        :ADMIN_ROLES.includes(u.role)
          ?'background:linear-gradient(135deg,var(--admin-purple),var(--admin-blue));color:#fff'
          :'background:linear-gradient(135deg,var(--admin-green),var(--admin-blue));color:#000';

      const avHtml = u.photoURL
        ? `<div class="ud-av-lg" style="overflow:hidden;padding:0"><img src="${u.photoURL}" alt="avatar" style="width:100%;height:100%;object-fit:cover;border-radius:50%"></div>`
        : `<div class="ud-av-lg" style="${avBg}">${ini}</div>`;

      body.innerHTML=`
        <div style="position:relative">
          <div class="ud-cover"></div>
          <button class="ud-close-btn" onclick="closeUserDetail()">✕</button>
          <div class="ud-av-zone">
            ${avHtml}
            <div class="ud-id">
              <div class="ud-id-name">${u.fullName||'—'}</div>
              <div class="ud-id-email">${u.email||'—'}</div>
            </div>
          </div>
        </div>
        <div class="ud-stat-row">
          <div class="ud-stat"><div class="ud-stat-v" style="color:var(--admin-green)">${fmt(u.sosBalance||0)}</div><div class="ud-stat-l"> SOS</div></div>
          <div class="ud-stat"><div class="ud-stat-v" style="color:var(--admin-gold)">${wins}</div><div class="ud-stat-l">🏆 Guul</div></div>
          <div class="ud-stat"><div class="ud-stat-v" style="color:var(--admin-blue)">${fmt(u.escrowSOS||0)}</div><div class="ud-stat-l">🔒 Escrow</div></div>
        </div>
        <div class="ud-info-block">
          <div class="ud-ir"><span class="ud-ir-l">📞 Telefon</span><span class="ud-ir-v">${u.phone||'—'}</span></div>
          <div class="ud-ir"><span class="ud-ir-l">📅 La Abuuray</span><span class="ud-ir-v">${joined}</span></div>
          <div class="ud-ir"><span class="ud-ir-l">👁️ Ugu dambeyn</span><span class="ud-ir-v" style="font-size:11px">${online?'<span style="color:var(--admin-green)">● Online hadda</span>':lastSeen}</span></div>
          <div class="ud-ir" style="cursor:pointer" onclick="udCopyUID('${userId}')">
            <span class="ud-ir-l">🔑 UID</span>
            <span class="ud-ir-v" style="font-family:monospace;font-size:10px;color:var(--text-muted)">${userId.slice(0,20)}… 📋</span>
          </div>
        </div>
        <div class="ud-section">
          <div class="ud-section-title">🔧 Role Bedel</div>
          <div class="ud-role-grid">${rolePills}</div>
        </div>
        <div class="ud-section">
          <div class="ud-section-title">💰 Balance Hagaaji</div>
          <div class="ud-bal-row">
            <input class="ud-bal-input" type="number" id="ud-bal-inp" placeholder="SOS..." min="1" inputmode="numeric">
            <button class="ud-bal-add" onclick="udAdjustBal('${userId}',true)">+ Ku Dar</button>
            <button class="ud-bal-sub" onclick="udAdjustBal('${userId}',false)">− Ka Jaro</button>
          </div>
          <div style="font-size:11px;color:var(--text-muted);margin-top:5px">Hadda: <strong style="color:var(--admin-green)">${fmt(u.sosBalance||0)} SOS</strong></div>
        </div>
        <div class="ud-section">
          <div class="ud-section-title">⚡ Ficilada Degdega</div>
          <div class="ud-qa-grid">
            <button class="ud-qa" onclick="udPwdReset('${u.email||''}')">🔑 Password Reset</button>
            <button class="ud-qa" onclick="udCopyUID('${userId}')">📋 UID Koobiyaa</button>
            <button class="ud-qa" onclick="window.open('https://console.firebase.google.com/project/ematch-bb818/firestore/data/users/${userId}','_blank')">🔥 Firebase Fur</button>
            <button class="ud-qa red" onclick="udSuspend('${userId}','${(u.fullName||'User').replace(/'/g,'')}')">🚫 Suspend</button>
          </div>
        </div>
        <div class="ud-section">
          <div class="ud-section-title">📋 Transactionyada Dambe</div>
          <div style="background:var(--bg-card2);border:1px solid var(--glass-border);border-radius:var(--r-md);overflow:hidden">${txHtml}</div>
        </div>
        <div style="height:env(safe-area-inset-bottom,24px)"></div>`;
    } catch(err){
      body.innerHTML=`<p style="padding:var(--sp-md);color:var(--admin-red)">Khalad: ${err.message}</p>`;
    }
  };

  window.closeUserDetail = function() {
    const o=$('ud-overlay'); if(o){o.classList.remove('open');document.body.style.overflow='';}
  };

  window.handleUdOverlay = function(e) {
    if(e.target===$('ud-overlay')) closeUserDetail();
  };

  window.udSetRole = async function(userId,role,label) {
    if(myRole!=='owner'&&(role==='administrator'||role==='owner')){toast('Awood kuma lihid role kan','error');return;}
    if(!confirm(`Role ku bedel: ${label}?\nUser: ${userId.slice(0,16)}...`)) return;
    try {
      await updateDoc(doc(db,'users',userId),{role});
      await addDoc(collection(db,'adminLogs'),{action:'change_role',adminUid:uid,targetUserId:userId,newRole:role,createdAt:serverTimestamp()});
      toast(`✅ Role: ${label}`,'success');
      const i=allUsers.findIndex(u=>u.id===userId); if(i>-1) allUsers[i].role=role;
      renderUsers(getFilteredUsers());
      closeUserDetail(); setTimeout(()=>openUserDetail(userId),300);
    } catch(err){toast('Khalad: '+err.message,'error');}
  };

  window.udAdjustBal = async function(userId,isAdd) {
    const amount=parseInt($('ud-bal-inp')?.value)||0;
    if(amount<1){toast('Qadarka geli (1+)','error');return;}
    const label=isAdd?`+${amount.toLocaleString()} SOS ku dar`:`-${amount.toLocaleString()} SOS ka jar`;
    if(!confirm(`💰 ${label}\nUser: ${userId.slice(0,16)}...`)) return;
    try {
      await runTransaction(db,async tx=>{
        const uRef=doc(db,'users',userId), uSnap=await tx.get(uRef);
        if(!uSnap.exists()) throw new Error('User la ma helin');
        const cur=uSnap.data().sosBalance||0, newBal=isAdd?cur+amount:Math.max(0,cur-amount);
        tx.update(uRef,{sosBalance:newBal});
        tx.set(doc(collection(db,'transactions')),{userId,type:isAdd?'admin_credit':'admin_debit',sos:isAdd?+amount:-amount,relatedMatch:null,createdAt:serverTimestamp(),meta:{adjustedBy:uid,reason:'manual_admin'}});
        tx.set(doc(collection(db,'adminLogs')),{action:isAdd?'credit_balance':'debit_balance',adminUid:uid,targetUserId:userId,amount,createdAt:serverTimestamp()});
      });
      toast(`✅ ${label}!`,'success');
      const i=allUsers.findIndex(u=>u.id===userId);
      if(i>-1) allUsers[i].sosBalance=isAdd?(allUsers[i].sosBalance||0)+amount:Math.max(0,(allUsers[i].sosBalance||0)-amount);
      renderUsers(getFilteredUsers());
      closeUserDetail(); setTimeout(()=>openUserDetail(userId),300);
    } catch(err){toast('Khalad: '+err.message,'error');}
  };

  window.udPwdReset = async function(email) {
    if(!email||email==='undefined'||email==='—'){toast('Email la ma helin','error');return;}
    try {
      const {getAuth:ga,sendPasswordResetEmail:spr}=await import('https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js');
      const {getApps:gA}=await import('https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js');
      const app2=gA().find(a=>a.name==='[DEFAULT]')||gA()[0];
      await spr(ga(app2),email);
      toast('✅ Password reset email la diray!','success');
    } catch(err){toast('Khalad: '+err.message,'error');}
  };

  window.udCopyUID = function(userId) {
    navigator.clipboard.writeText(userId)
      .then(()=>toast('✅ UID la koobiyay!','info'))
      .catch(()=>toast('Koobiyayntu waa fashilantay','error'));
  };

  window.udSuspend = function(userId,name) {
    if(!confirm(`🚫 User suspend garee?\n${name}`)) return;
    udSetRole(userId,'suspended','🚫 Suspended');
  };

  // ══════════════════════════════════════════════════════════
  // GAMES SETTINGS PANEL
  // ══════════════════════════════════════════════════════════
  let _gseData = null; // local editable copy

  const loadGamesPanel = window.loadGamesPanel = async function() {
    const gamesList  = $('gs-games-list');
    const presets    = $('gs-presets-list');
    const minInput   = $('gs-min-stake');
    const maxInput   = $('gs-max-stake');
    if (!gamesList) return;
    gamesList.innerHTML = '<div style="text-align:center;padding:20px;color:var(--text-muted)">⏳</div>';
    try {
      const snap = await getDoc(doc(db,'game_settings','config'));
      _gseData = snap.exists() ? JSON.parse(JSON.stringify(snap.data())) : {
        games: [
          {id:'FC Mobile',  name:'FC Mobile',   emoji:'⚽', active:true},
          {id:'FIFA',       name:'FIFA',         emoji:'⚽', active:true},
          {id:'eFootball',  name:'eFootball',    emoji:'⚽', active:true},
          {id:'NBA 2K',     name:'NBA 2K',       emoji:'🏀', active:true},
          {id:'PUBG',       name:'PUBG Mobile',  emoji:'🔫', active:true},
          {id:'Free Fire',  name:'Free Fire',    emoji:'🔫', active:true},
          {id:'COD',        name:'COD Mobile',   emoji:'🔫', active:true},
        ],
        stakePresets: [10000, 25000, 50000, 100000],
        minStake: 8000,
        maxStake: 0
      };
    } catch(e) { gamesList.innerHTML = '<p style="color:var(--admin-red);padding:12px">Khalad: ' + e.message + '</p>'; return; }

    if (minInput) minInput.value = _gseData.minStake || 8000;
    if (maxInput) maxInput.value = _gseData.maxStake || 0;
    gseRenderPresets();
    gseRenderGames();
  };

  function gseRenderPresets() {
    const el = $('gs-presets-list'); if (!el) return;
    const presets = _gseData.stakePresets || [];
    el.innerHTML = presets.map((p,i) =>
      `<div class="gs-preset-item">
        <span class="gs-preset-val">${p>=1000000?(p/1000000).toFixed(1)+'M':p>=1000?Math.round(p/1000)+'K':p} SOS</span>
        <button class="gs-preset-del" onclick="gseRemovePreset(${i})">✕</button>
      </div>`
    ).join('') || '<span style="color:var(--text-muted);font-size:12px">Preset ma jiro</span>';
  }

  function gseRenderGames() {
    const el = $('gs-games-list'); if (!el) return;
    const games = _gseData.games || [];
    el.innerHTML = games.map((g,i) =>
      `<div class="gs-game-item">
        <input class="gs-game-emoji-inp" type="text" value="${g.emoji||'🎮'}" maxlength="2"
          oninput="_gseData.games[${i}].emoji=this.value" title="Emoji">
        <input class="gs-game-name-inp" type="text" value="${g.name||''}" placeholder="Game magac..."
          oninput="_gseData.games[${i}].name=this.value;_gseData.games[${i}].id=this.value">
        <label class="gs-game-toggle" title="${g.active!==false?'Active':'Hidden'}">
          <input type="checkbox" ${g.active!==false?'checked':''} onchange="_gseData.games[${i}].active=this.checked">
          <span class="gs-slider"></span>
        </label>
        <button class="gs-game-del" onclick="gseRemoveGame(${i})" title="Tirtir">🗑️</button>
      </div>`
    ).join('') || '<p style="color:var(--text-muted);font-size:13px;padding:8px">Game ma jiro</p>';
  }

  window.gseAddPreset = function() {
    const val = parseInt(prompt('Preset amount (SOS):'));
    if (!val || val < 1) return;
    if (!_gseData.stakePresets) _gseData.stakePresets = [];
    _gseData.stakePresets.push(val);
    _gseData.stakePresets.sort((a,b) => a-b);
    gseRenderPresets();
  };

  window.gseRemovePreset = function(i) {
    _gseData.stakePresets.splice(i, 1);
    gseRenderPresets();
  };

  window.gseAddGame = function() {
    if (!_gseData.games) _gseData.games = [];
    _gseData.games.push({ id:'Game Cusub', name:'Game Cusub', emoji:'🎮', active:true });
    gseRenderGames();
  };

  window.gseRemoveGame = function(i) {
    if (!confirm('Game-kan tirtir?')) return;
    _gseData.games.splice(i, 1);
    gseRenderGames();
  };

  window.gseSaveAll = async function() {
    if (!_gseData) return;
    const btn = $('gs-save-btn');
    if (btn) { btn.textContent = '⏳ Kaydinayaa...'; btn.disabled = true; }
    try {
      // Read inputs
      _gseData.minStake = parseInt($('gs-min-stake')?.value) || 8000;
      _gseData.maxStake = parseInt($('gs-max-stake')?.value) || 0;
      // Clean games — remove empty names
      _gseData.games = (_gseData.games || []).filter(g => g.name?.trim());
      // Sort presets
      _gseData.stakePresets = (_gseData.stakePresets || []).sort((a,b) => a-b);

      // Use setDoc (merge) — works whether doc exists or not
      await setDoc(doc(db,'game_settings','config'), _gseData);

      await addDoc(collection(db,'adminLogs'), {
        action:'update_game_settings', adminUid:uid,
        createdAt:serverTimestamp(), meta:{ gamesCount: _gseData.games.length }
      });

      toast('✅ Game settings la keydsaday!', 'success');
      gseRenderPresets();
      gseRenderGames();
    } catch(e) { toast('Khalad: ' + e.message, 'error'); }
    finally { if (btn) { btn.textContent = '💾 Kaydi'; btn.disabled = false; } }
  };

  // ── Init ────────────────────────────────────────────────
  loadStats();

})();
