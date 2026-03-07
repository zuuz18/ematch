// ============================================================
// eMatch — js/app.js  (v2.1 — logout fix)
// ============================================================

import { initializeApp } from
  "https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js";
import {
  getAuth,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
  sendPasswordResetEmail,
  GoogleAuthProvider,
  signInWithPopup,
  signInWithRedirect,
  getRedirectResult,
  browserLocalPersistence,
  setPersistence
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js";
import {
  getFirestore,
  doc, getDoc, setDoc, updateDoc,
  addDoc, collection,
  serverTimestamp,
  query, where, orderBy, limit,
  getDocs, onSnapshot,
  runTransaction
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";

// ── 1. FIREBASE CONFIG ─────────────────────────────────────
const firebaseConfig = {
  apiKey: "AIzaSyAW921oL1KTEk5n75xWvfGWM4Ab1SKnpbg",
  authDomain: "ematch8.netlify.app",
  databaseURL: "https://ematch-bb818-default-rtdb.firebaseio.com",
  projectId: "ematch-bb818",
  storageBucket: "ematch-bb818.firebasestorage.app",
  messagingSenderId: "955647946180",
  appId: "1:955647946180:web:c66947044f0dd6f633c891"
};

const app  = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db   = getFirestore(app);

setPersistence(auth, browserLocalPersistence);

// ── 2. GLOBAL STATE ────────────────────────────────────────
let currentUser     = null;
let currentUserData = null;
let isOnline        = navigator.onLine;

// ── 3. EXPOSE GLOBALS ──────────────────────────────────────
window._ematch_config   = firebaseConfig;
window._ematch_db       = db;
window._ematch_uid      = null;
window._ematch_userdata = null;

// ── IMGBB UPLOAD UTILITY ───────────────────────────────────
const IMGBB_KEY = 'e40ca77f38c298d7f8d5c1dde3893f91';

window.uploadToImgbb = async function(file, name) {
  const formData = new FormData();
  formData.append('image', file);
  if (name) formData.append('name', name);
  const res = await fetch(`https://api.imgbb.com/1/upload?key=${IMGBB_KEY}`, {
    method: 'POST', body: formData
  });
  if (!res.ok) throw new Error('imgbb upload failed: ' + res.status);
  const json = await res.json();
  if (!json.success) throw new Error(json.error?.message || 'imgbb error');
  return {
    url:       json.data.url,         // direct image url
    thumb:     json.data.thumb?.url,  // thumbnail
    display:   json.data.display_url, // display url
    deleteUrl: json.data.delete_url,  // delete link
    id:        json.data.id,
    size:      json.data.size,
    title:     json.data.title
  };
};


// ── 4. UTILITIES ───────────────────────────────────────────
function setLoading(btn, loading) {
  if (!btn) return;
  btn.classList.toggle('loading', loading);
  btn.disabled = loading;
}

function showError(fieldId, msg) {
  const field = document.getElementById(fieldId);
  const errEl = document.getElementById(fieldId + '_err');
  if (field) field.classList.add('input-error');
  if (errEl) errEl.textContent = msg;
}

function clearErrors(formId) {
  const form = document.getElementById(formId);
  if (!form) return;
  form.querySelectorAll('.input-error').forEach(el => el.classList.remove('input-error'));
  form.querySelectorAll('.error-msg').forEach(el => el.textContent = '');
}

window.showToast = function(msg, type = 'info') {
  const existing = document.getElementById('toast');
  if (existing) existing.remove();
  const toast = document.createElement('div');
  toast.id = 'toast';
  const colors = {
    error:   'var(--accent-red)',
    success: 'var(--accent-green)',
    info:    'var(--bg-card2)',
    warning: 'var(--accent-gold)'
  };
  Object.assign(toast.style, {
    position: 'fixed', bottom: '90px', left: '50%',
    transform: 'translateX(-50%) translateY(20px)',
    background: colors[type] || colors.info,
    color: type === 'success' ? '#000' : '#fff',
    padding: '10px 20px', borderRadius: 'var(--r-full)',
    fontSize: '14px', fontWeight: '600', zIndex: '9999',
    maxWidth: '360px', textAlign: 'center',
    transition: 'all 240ms var(--ease)',
    border: '1px solid var(--glass-border)',
    boxShadow: '0 4px 20px rgba(0,0,0,.5)',
    opacity: '0', pointerEvents: 'none'
  });
  toast.textContent = msg;
  document.body.appendChild(toast);
  requestAnimationFrame(() => {
    toast.style.transform = 'translateX(-50%) translateY(0)';
    toast.style.opacity   = '1';
  });
  setTimeout(() => {
    toast.style.opacity   = '0';
    toast.style.transform = 'translateX(-50%) translateY(10px)';
    setTimeout(() => toast.remove(), 300);
  }, 3200);
};

window.openModal = function(modalId) {
  const overlay = document.getElementById(modalId);
  if (!overlay) return;
  overlay.classList.add('open');
  document.body.style.overflow = 'hidden';
  history.pushState({ modal: modalId }, '');
  const focusable = overlay.querySelector('input, button, select');
  if (focusable) setTimeout(() => focusable.focus(), 250);
};

window.closeModal = function(modalId) {
  const overlay = document.getElementById(modalId);
  if (!overlay) return;
  overlay.classList.remove('open');
  document.body.style.overflow = '';
};

function requireOnline() {
  if (!isOnline) {
    showToast('Xiriirka internetka kuma jirto. Isku day markale.', 'error');
    return false;
  }
  return true;
}

const validateEmail    = e  => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e);
const validatePhone    = p  => /^[+]?[0-9]{9,15}$/.test(p.replace(/\s/g, ''));
const validatePassword = pw => pw.length >= 8;

// ── 5. OFFLINE DETECTION ───────────────────────────────────
function updateOnlineStatus() {
  isOnline = navigator.onLine;
  const banner = document.getElementById('offline-banner');
  if (banner) banner.classList.toggle('hidden', isOnline);
}
window.addEventListener('online',  updateOnlineStatus);
window.addEventListener('offline', updateOnlineStatus);
updateOnlineStatus();

// ── 6. MODAL: CLOSE ON BACK ────────────────────────────────
window.addEventListener('popstate', () => {
  const openModalEl = document.querySelector('.modal-overlay.open');
  if (openModalEl) {
    closeModal(openModalEl.id);
    history.pushState(null, '', window.location.href);
  }
});

// ── 7. AUTH GUARD ──────────────────────────────────────────
// Returns the user if auth passes, null otherwise.
// If requireAuth=true and no user → redirect to index.html
// If requireAuth=false and user exists → redirect to redirectTo
function authGuard(requireAuth, redirectTo = 'dashboard.html') {
  return new Promise(resolve => {
    const unsub = onAuthStateChanged(auth, async user => {
      unsub();
      if (requireAuth && !user) {
        window.location.replace('index.html');
        resolve(null);
      } else if (!requireAuth && user) {
        window.location.replace(redirectTo);
        resolve(user); // return user so caller knows redirect happened
      } else if (user) {
        currentUser = user;
        await loadUserData(user.uid);
        resolve(user);
      } else {
        resolve(null);
      }
    });
  });
}

// ── 8. LOAD USER DATA ──────────────────────────────────────
async function loadUserData(uid) {
  try {
    const userRef = doc(db, 'users', uid);
    const snap    = await getDoc(userRef);
    if (snap.exists()) {
      currentUserData = snap.data();
    } else {
      const user = auth.currentUser;
      currentUserData = {
        uid,
        fullName:  user?.displayName || 'User',
        email:     user?.email       || '',
        phone:     '',
        role:      'user',
        sosBalance: 0,
        escrowSOS:  0,
        createdAt:  serverTimestamp()
      };
      await setDoc(userRef, currentUserData);
    }
    window._ematch_uid      = uid;
    window._ematch_userdata = currentUserData;
    updateHeaderUI();
    if (window._navUpdate) window._navUpdate(currentUserData);

    // ── Patch lastSeen (always) + createdAt (if missing) ──
    try {
      const patch = { lastSeen: serverTimestamp() };
      if (!currentUserData.createdAt) patch.createdAt = serverTimestamp();
      await updateDoc(doc(db, 'users', uid), patch);
    } catch(_) {}
    try {
      localStorage.setItem('ematch_user_cache', JSON.stringify({
        ...currentUserData,
        createdAt: currentUserData.createdAt?.toDate?.()?.toISOString() || null
      }));
    } catch (_) {}
    return currentUserData;
  } catch (err) {
    console.error('loadUserData:', err);
    const cached = localStorage.getItem('ematch_user_cache');
    if (cached) {
      currentUserData         = JSON.parse(cached);
      window._ematch_uid      = currentUserData.uid;
      window._ematch_userdata = currentUserData;
    }
  }
}

// ── 9. UPDATE HEADER UI ────────────────────────────────────
function updateHeaderUI() {
  if (!currentUserData) return;

  // Delegate balance + initials to nav.js (single source of truth)
  if (window._navUpdate) {
    window._navUpdate(currentUserData);
  } else {
    const coins = currentUserData.sosBalance || 0;
    const fmt   = window.sosFormat ? window.sosFormat(coins) : coins.toLocaleString();
    document.querySelectorAll(".sos-balance-display").forEach(el => { el.textContent = fmt + " SOS"; });
    const initials = (currentUserData.fullName || "U").split(" ").map(w => w[0]).join("").toUpperCase().slice(0, 2);
    document.querySelectorAll(".avatar").forEach(a => { a.textContent = initials; });
  }

  // Admin visibility
  const adminRoles = ["administrator", "owner", "partner_manager"];
  if (adminRoles.includes(currentUserData.role)) {
    document.querySelectorAll(".admin-only").forEach(el => el.classList.remove("hidden"));
    const adminPanel = document.getElementById("admin-panel");
    if (adminPanel) adminPanel.classList.remove("hidden");
  }
}

// ── 10. SIGNUP ─────────────────────────────────────────────
async function handleSignup(e) {
  e.preventDefault();
  if (!requireOnline()) return;
  const fullName = document.getElementById('reg_fullName').value.trim();
  const email    = document.getElementById('reg_email').value.trim();
  const phone    = document.getElementById('reg_phone').value.trim();
  const password = document.getElementById('reg_password').value;
  const btn      = document.getElementById('btn_register');
  clearErrors('register-form');
  let valid = true;
  if (!fullName || fullName.length < 2) { showError('reg_fullName', 'Magaca oo buuxa geli'); valid = false; }
  if (!validateEmail(email))            { showError('reg_email',    'Email-ka sax ma ahan'); valid = false; }
  if (!validatePhone(phone))            { showError('reg_phone',    'Lambarka sax geli (+252...)'); valid = false; }
  if (!validatePassword(password))      { showError('reg_password', 'Password-ku waa inuu ka badan yahay 8 xaraf'); valid = false; }
  if (!valid) return;
  setLoading(btn, true);
  try {
    const cred = await createUserWithEmailAndPassword(auth, email, password);
    await setDoc(doc(db, 'users', cred.user.uid), {
      uid: cred.user.uid, fullName, email, phone,
      role: 'user', sosBalance: 0, escrowSOS: 0,
      createdAt: serverTimestamp()
    });
    window.location.replace('dashboard.html');
  } catch (err) {
    setLoading(btn, false);
    const errorMap = {
      'auth/email-already-in-use': ['reg_email',    'Email-kani horey loo isticmaalay'],
      'auth/weak-password':        ['reg_password', 'Password-ku aad ayuu u liita'],
      'auth/invalid-email':        ['reg_email',    'Email-ka foomka sax ma ahan']
    };
    const mapped = errorMap[err.code];
    if (mapped) showError(mapped[0], mapped[1]);
    else showToast('Khalad: ' + err.message, 'error');
  }
}

// ── 11. LOGIN ──────────────────────────────────────────────
async function handleLogin(e) {
  e.preventDefault();
  if (!requireOnline()) return;
  const email    = document.getElementById('login_email').value.trim();
  const password = document.getElementById('login_password').value;
  const btn      = document.getElementById('btn_login');
  clearErrors('login-form');
  if (!validateEmail(email)) { showError('login_email',    'Email-ka sax ma ahan'); return; }
  if (!password)             { showError('login_password', 'Password-ka geli');     return; }
  setLoading(btn, true);
  try {
    await signInWithEmailAndPassword(auth, email, password);
    window.location.replace('dashboard.html');
  } catch (err) {
    setLoading(btn, false);
    const badCreds = ['auth/invalid-credential','auth/user-not-found','auth/wrong-password','auth/invalid-email'];
    if (badCreds.includes(err.code)) showToast('Email ama password-ku khaldan yahay', 'error');
    else showToast('Khalad: ' + err.message, 'error');
  }
}

// ── 12. GOOGLE SIGN-IN ─────────────────────────────────────
async function handleGoogleSignIn() {
  if (!requireOnline()) return;

  const btns = ['btn_google','btn_google_reg'].map(id => document.getElementById(id)).filter(Boolean);
  btns.forEach(b => { b.disabled = true; b.style.opacity = '.6'; });

  const provider = new GoogleAuthProvider();
  provider.addScope('email');
  provider.addScope('profile');
  provider.setCustomParameters({ prompt: 'select_account' });

  try {
    await signInWithRedirect(auth, provider);
    // Page will reload — result handled by getRedirectResult below
  } catch (err) {
    btns.forEach(b => { b.disabled = false; b.style.opacity = ''; });
    showToast('Google sign-in khalad: ' + err.message, 'error');
  }
}

async function _handleGoogleCred(cred) {
  if (!cred?.user) return;
  const uid     = cred.user.uid;
  const userRef = doc(db, 'users', uid);
  const snap    = await getDoc(userRef);
  if (!snap.exists()) {
    await setDoc(userRef, {
      uid,
      fullName:   cred.user.displayName || '',
      email:      cred.user.email || '',
      phone:      '',
      photoURL:   cred.user.photoURL || '',
      role:       'user',
      sosBalance: 0,
      escrowSOS:  0,
      createdAt:  serverTimestamp()
    });
  } else if (cred.user.photoURL && !snap.data().photoURL) {
    await updateDoc(userRef, { photoURL: cred.user.photoURL });
  }
  window.location.replace('dashboard.html');
}

// ── 13. PASSWORD RESET ─────────────────────────────────────
window.handlePasswordReset = async function() {
  const emailInput = document.getElementById('login_email');
  const email      = emailInput?.value.trim() || prompt('Email-kaaga geli:');
  if (!email || !validateEmail(email)) { showToast('Email sax ah geli', 'error'); return; }
  if (!requireOnline()) return;
  try {
    await sendPasswordResetEmail(auth, email);
    showToast('✅ Email dib-u-dejinta password-ka la diray', 'success');
  } catch (err) {
    showToast('Khalad: ' + err.message, 'error');
  }
};

// ── 14. LOGOUT ─────────────────────────────────────────────
async function handleLogout() {
  try {
    // Clear all local state first
    currentUser     = null;
    currentUserData = null;
    window._ematch_uid      = null;
    window._ematch_userdata = null;

    localStorage.removeItem('ematch_user_cache');
    // Mark that we just logged out — prevents index.html from auto-redirecting
    sessionStorage.setItem('ematch_logged_out', '1');
    // Then sign out from Firebase
    await signOut(auth);
    // Force hard navigation to login — no back-button return
    window.location.href = 'index.html';
  } catch (err) {
    showToast('Khalad: ' + err.message, 'error');
  }
}
window.handleLogout = handleLogout;

// ── 15. PASSWORD TOGGLE ────────────────────────────────────
function initPasswordToggles() {
  document.querySelectorAll('.pw-toggle').forEach(btn => {
    btn.addEventListener('click', () => {
      const wrap  = btn.closest('.input-wrap');
      const input = wrap?.querySelector('input[type="password"], input[type="text"]');
      if (!input) return;
      const hidden  = input.type === 'password';
      input.type    = hidden ? 'text' : 'password';
      btn.innerHTML = hidden
        ? `<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"/><line x1="1" y1="1" x2="23" y2="23"/></svg>`
        : `<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>`;
    });
  });
}

// ── 16. LOAD MATCHES LIST ──────────────────────────────────
let _matchesUnsub = null;

function loadMatches(container, filter = 'all') {
  if (!container) return;
  if (_matchesUnsub) { _matchesUnsub(); _matchesUnsub = null; }
  container.innerHTML = Array(3).fill(`
    <div class="card mb-md">
      <div class="skeleton sk-block mb-md"></div>
      <div class="skeleton sk-line" style="width:60%"></div>
      <div class="skeleton sk-line" style="width:80%"></div>
    </div>`).join('');
  const q = filter === 'all'
    ? query(collection(db, 'matches'), orderBy('createdAt','desc'), limit(25))
    : query(collection(db, 'matches'), where('status','==',filter), orderBy('createdAt','desc'), limit(25));
  const unsub = onSnapshot(q, snap => {
    if (snap.empty) {
      container.innerHTML = `
        <div class="empty-state" style="min-height:200px">
          <div style="font-size:48px;margin-bottom:16px">🎮</div>
          <h3>Match la'aan</h3>
          <p>Hadda wax match ah ma jiro. Abuur mid cusub!</p>
        </div>`;
      return;
    }
    container.innerHTML = snap.docs.map(d => renderMatchCard(d.id, d.data())).join('');
    container.querySelectorAll('.match-card').forEach(card => {
      card.addEventListener('click', () => openMatchModal(card.dataset.id));
    });
  }, err => {
    container.innerHTML = `<p class="text-center p-md text-muted">Khalad: ${err.message}</p>`;
  });
  return unsub;
}

// ── 17. RENDER MATCH CARD ──────────────────────────────────
function renderMatchCard(id, m) {
  const emojiMap = {
    'FIFA':'⚽','FC Mobile':'⚽','eFootball':'⚽',
    'NBA 2K':'🏀','PUBG':'🔫','Free Fire':'🔫','COD':'🔫'
  };
  const emoji  = emojiMap[m.platform] || '🎮';
  const isLive = m.status === 'locked';
  const fmt    = window.sosFormat || (n => n.toLocaleString());
  return `
    <div class="match-card" data-id="${id}" role="listitem" tabindex="0"
      aria-label="${m.platform} match, stake: ${m.stakeAmount} SOS">
      <div class="match-card-banner">
        <span>${emoji}</span>
        ${isLive ? '<div class="live-badge">LIVE</div>' : ''}
      </div>
      <div class="match-card-body">
        <div class="match-meta">
          <span class="match-platform-tag">${m.platform || 'Unknown'}</span>
          <span class="status-pill ${m.status || 'open'}">${
            m.status === 'open'   ? 'Furan'      :
            m.status === 'locked' ? 'Socda'      :
            m.status === 'done'   ? 'Dhammaaday' : m.status
          }</span>
        </div>
        <h3>${m.title || m.platform + ' Match'}</h3>
        <div class="match-footer">
          <div class="stake-amount">${window.sosCoin?window.sosCoin(m.stakeAmount||0,18):''} ${fmt(m.stakeAmount||0)} SOS</div>
          <span class="players-joined">
            ${m.joinedBy ? '2/2 ▶ Socda' : '1/2 ⏳ Sugaysa'}
          </span>
        </div>
      </div>
    </div>`;
}

// ── 18. OPEN MATCH MODAL ───────────────────────────────────
async function openMatchModal(matchId) {
  openModal('match-modal');
  const content = document.getElementById('match-modal-content');
  if (!content) return;
  content.innerHTML = `
    <div class="modal-handle"></div>
    <div class="skeleton sk-block mb-md"></div>
    <div class="skeleton sk-line" style="width:70%"></div>
    <div class="skeleton sk-line" style="width:50%"></div>`;
  try {
    const snap = await getDoc(doc(db, 'matches', matchId));
    if (!snap.exists()) {
      content.innerHTML = '<p class="text-muted p-md">Match la ma helin</p>';
      return;
    }
    const m      = snap.data();
    const bal    = currentUserData?.sosBalance || 0;
    const fmt    = window.sosFormat || (n => n.toLocaleString());
    const canJoin = m.status === 'open' && currentUser?.uid !== m.createdBy && !m.joinedBy && bal >= (m.stakeAmount||0);
    const noFunds = m.status === 'open' && currentUser?.uid !== m.createdBy && !m.joinedBy && bal < (m.stakeAmount||0);

    content.innerHTML = `
      <div class="modal-handle"></div>
      <div class="modal-header">
        <h2>🎮 ${m.title || m.platform + ' Match'}</h2>
        <button class="modal-close" onclick="closeModal('match-modal')" aria-label="Xidh">✕</button>
      </div>
      <div class="match-meta mb-md">
        <span class="match-platform-tag">${m.platform}</span>
        <span class="status-pill ${m.status}">${
          m.status === 'open'   ? 'Furan'   :
          m.status === 'locked' ? '🔴 LIVE' : 'Dhammaaday'
        }</span>
      </div>
      <div class="grid-2 mb-md">
        <div class="card" style="text-align:center;padding:var(--sp-md)">
          <div style="font-size:22px;font-weight:900;color:var(--accent-green)">
            ${window.sosCoin?window.sosCoin(m.stakeAmount||0,18):''} ${fmt(m.stakeAmount||0)} SOS
          </div>
          <div style="font-size:11px;color:var(--text-muted);margin-top:2px">Stake</div>
        </div>
        <div class="card" style="text-align:center;padding:var(--sp-md)">
          <div style="font-size:22px;font-weight:900;color:var(--accent-gold)">
            ${window.sosCoin?window.sosCoin((m.stakeAmount||0)*2,18):''} ${fmt((m.stakeAmount||0)*2)} SOS
          </div>
          <div style="font-size:11px;color:var(--text-muted);margin-top:2px">Prize</div>
        </div>
      </div>
      <div class="card mb-md">
        <div class="flex items-center gap-md" style="justify-content:space-around">
          <div style="text-align:center">
            <div style="width:48px;height:48px;border-radius:50%;
              background:linear-gradient(135deg,var(--accent-green),var(--accent-blue));
              display:flex;align-items:center;justify-content:center;
              font-size:18px;font-weight:900;color:#000;margin:0 auto 6px">
              ${(m.createdBy||'?')[0].toUpperCase()}
            </div>
            <div style="font-size:11px;color:var(--text-muted)">${(m.createdBy||'').slice(0,8)}...</div>
            ${m.winnerId===m.createdBy ? '<div style="color:var(--accent-gold)">🏆</div>' : ''}
          </div>
          <div style="font-size:18px;font-weight:900;color:var(--text-muted)">VS</div>
          <div style="text-align:center">
            ${m.joinedBy ? `
              <div style="width:48px;height:48px;border-radius:50%;
                background:linear-gradient(135deg,var(--accent-red),#dc2626);
                display:flex;align-items:center;justify-content:center;
                font-size:18px;font-weight:900;color:#fff;margin:0 auto 6px">
                ${m.joinedBy[0].toUpperCase()}
              </div>
              <div style="font-size:11px;color:var(--text-muted)">${m.joinedBy.slice(0,8)}...</div>
              ${m.winnerId===m.joinedBy ? '<div style="color:var(--accent-gold)">🏆</div>' : ''}
            ` : `
              <div style="width:48px;height:48px;border-radius:50%;
                background:var(--bg-card2);border:2px dashed var(--border);
                display:flex;align-items:center;justify-content:center;
                font-size:20px;margin:0 auto 6px">⏳</div>
              <div style="font-size:11px;color:var(--text-muted)">Sugaysa...</div>
            `}
          </div>
        </div>
      </div>
      ${canJoin ? `
        <div class="form-group mt-sm">
          <label style="font-size:12px;font-weight:700;color:var(--text-muted)">
            Game-ka Magacaaga (In-Game Username)
          </label>
          <div class="input-wrap">
            <input type="text" id="join_username" placeholder="Tusaale: PlayerXX123"
              style="font-size:14px" autocomplete="off">
          </div>
        </div>
        <button class="btn btn-primary mt-sm" id="btn_join_match"
          data-id="${matchId}" data-stake="${m.stakeAmount}">
          <span class="btn-text">🎮 Ku Biir — ${window.sosCoin?window.sosCoin(m.stakeAmount||0,18):''} ${fmt(m.stakeAmount||0)} SOS</span>
          <div class="btn-spinner"></div>
        </button>` : ''}
      ${m.status==='locked' && (currentUser?.uid===m.createdBy || currentUser?.uid===m.joinedBy) ? `
        <div class="card mt-sm" style="background:rgba(0,230,118,.04);border-color:rgba(0,230,118,.15)">
          <div style="font-size:12px;font-weight:700;color:var(--text-muted);margin-bottom:8px">
            📸 Natiijooyinka Dir — AI ayaa go'aan qaadanayaa
          </div>
          <label class="btn btn-ghost" style="cursor:pointer;width:100%;justify-content:center">
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/>
              <circle cx="12" cy="13" r="4"/>
            </svg>
            &nbsp; Screenshot Dir
            <input type="file" accept="image/*" style="display:none"
              onchange="analyzeScreenshot('${matchId}', this.files[0], '${currentUser?.uid}')">
          </label>
          <div style="font-size:11px;color:var(--text-muted);margin-top:6px;text-align:center">
            AI screenshot-ka akhrin doona oo winner automatic go'aamin doona
          </div>
        </div>` : ''}
      ${m.status==='open' && currentUser?.uid===m.createdBy ? `
        <div class="card mt-sm" style="background:rgba(0,230,118,.05);border-color:rgba(0,230,118,.2);text-align:center">
          <p style="font-size:13px;color:var(--accent-green)">✅ Adaa abuuray — qof kale ayaa la sugayaa</p>
        </div>` : ''}
      ${noFunds ? `
        <div class="card mt-sm" style="border-color:rgba(239,68,68,.3);text-align:center">
          <p class="text-red" style="font-size:13px;margin-bottom:8px">
            💸 Lacag kuma filna. Wallet-kaaga ku shub.
          </p>
          <a href="wallet.html" class="btn btn-gold btn-sm" style="text-decoration:none;width:auto;margin:0 auto">
            + Deposit
          </a>
        </div>` : ''}`;

    const joinBtn = content.querySelector('#btn_join_match');
    if (joinBtn) {
      joinBtn.addEventListener('click', () => {
        const username = document.getElementById('join_username')?.value.trim() || '';
        if (!username) { showToast('Game-ka magacaaga geli', 'error'); return; }
        joinMatch(matchId, parseInt(joinBtn.dataset.stake), username);
      });
    }
  } catch (err) {
    content.innerHTML = `<p class="text-muted p-md">Khalad: ${err.message}</p>`;
  }
}

// ── 19. JOIN MATCH ─────────────────────────────────────────
async function joinMatch(matchId, stakeAmount, inGameUsername) {
  if (!requireOnline() || !currentUser) return;
  const btn = document.getElementById('btn_join_match') || document.getElementById('btn_join_from_matches');
  if (btn) setLoading(btn, true);
  try {
    await runTransaction(db, async tx => {
      const matchRef = doc(db, 'matches', matchId);
      const userRef  = doc(db, 'users',   currentUser.uid);
      const [mSnap, uSnap] = await Promise.all([tx.get(matchRef), tx.get(userRef)]);
      if (!mSnap.exists()) throw new Error('Match la ma helin');
      const match = mSnap.data();
      const user  = uSnap.data();
      if (match.status !== 'open')            throw new Error('Match-ku xidhmay');
      if (match.joinedBy)                      throw new Error('Match-ku buuxay');
      if (match.createdBy === currentUser.uid) throw new Error('Adigu abuuray match-kan');
      if ((user.sosBalance||0) < stakeAmount)  throw new Error('Lacag kuma filna');
      tx.update(matchRef, {
        joinedBy: currentUser.uid, joinedByUsername: inGameUsername || '',
        status: 'locked', lockedAt: serverTimestamp()
      });
      tx.update(userRef, {
        sosBalance: (user.sosBalance||0) - stakeAmount,
        escrowSOS:  (user.escrowSOS||0)  + stakeAmount
      });
      tx.set(doc(collection(db, 'transactions')), {
        userId: currentUser.uid, type: 'escrow_lock', sos: -stakeAmount,
        relatedMatch: matchId, createdAt: serverTimestamp(), meta: { action: 'join', matchId }
      });
    });
    await loadUserData(currentUser.uid);
    closeModal('match-modal');
    showToast('✅ Match ku biirtay! Ciyaar fiican 🎮', 'success');
  } catch (err) {
    if (btn) setLoading(btn, false);
    showToast(err.message, 'error');
  }
}
window.joinMatchGlobal = joinMatch;

// ── 19b. GAME SETTINGS CACHE ───────────────────────────────
let _gameSettings = null; // { games: [{id, name, emoji, active}], stakePresets:[], minStake, maxStake }

async function loadGameSettings() {
  if (_gameSettings) return _gameSettings;
  try {
    const snap = await getDoc(doc(db, 'game_settings', 'config'));
    if (snap.exists()) {
      _gameSettings = snap.data();
    }
  } catch(e) { console.warn('loadGameSettings:', e.message); }
  // Fallback defaults hadduu Firestore-ka waxba ku jirin
  if (!_gameSettings) {
    _gameSettings = {
      games: [
        { id:'FC Mobile',    name:'FC Mobile',    emoji:'⚽', active:true },
        { id:'FIFA',         name:'FIFA',          emoji:'⚽', active:true },
        { id:'eFootball',    name:'eFootball',     emoji:'⚽', active:true },
        { id:'NBA 2K',       name:'NBA 2K',        emoji:'🏀', active:true },
        { id:'PUBG',         name:'PUBG Mobile',   emoji:'🔫', active:true },
        { id:'Free Fire',    name:'Free Fire',     emoji:'🔫', active:true },
        { id:'COD',          name:'COD Mobile',    emoji:'🔫', active:true },
      ],
      stakePresets: [10000, 25000, 50000, 100000],
      minStake: 8000,
      maxStake: 0 // 0 = xad la'aan
    };
  }
  return _gameSettings;
}

async function initCreateModal() {
  const settings = await loadGameSettings();
  const games    = (settings.games || []).filter(g => g.active !== false);
  const grid     = document.getElementById('cm-games-grid');
  const stakeEl  = document.getElementById('cm_stake');
  const rangeLbl = document.getElementById('cm-stake-range');
  const stakeBtn = document.getElementById('cm-stake-btns');

  // Render game buttons
  if (grid) {
    grid.innerHTML = games.map(g => `
      <button type="button" class="cm-game-btn" data-game="${g.id}"
        onclick="cmSelectGame('${g.id}','${g.emoji}','${g.name}')">
        <span class="cm-game-emoji">${g.emoji}</span>
        <span>${g.name}</span>
      </button>`).join('') || '<p style="color:var(--text-muted);text-align:center;grid-column:1/-1;padding:16px">Wax game ah ma jiro</p>';
  }

  // Stake range label
  const min = settings.minStake || 8000;
  const max = settings.maxStake || 0;
  if (rangeLbl) rangeLbl.textContent = max > 0
    ? `(${(min/1000).toFixed(0)}K – ${(max/1000).toFixed(0)}K SOS)`
    : `(Min: ${(min/1000).toFixed(0)}K SOS)`;

  // Quick stake buttons
  const presets = settings.stakePresets || [10000, 25000, 50000, 100000];
  if (stakeBtn) {
    stakeBtn.innerHTML = presets.map(p =>
      `<button type="button" class="cm-stake-pill" data-stake="${p}"
        onclick="cmSelectStake(${p},this)">${p>=1000000?(p/1000000).toFixed(1)+'M':p>=1000?(p/1000).toFixed(0)+'K':p} SOS</button>`
    ).join('');
  }

  // Set min attribute on input
  if (stakeEl) {
    stakeEl.min  = min;
    stakeEl.placeholder = `Min: ${(min/1000).toFixed(0)}K SOS`;
    if (max > 0) stakeEl.max = max;
  }

  // Reset selections
  document.getElementById('cm_platform').value = '';
  const headerIcon = document.getElementById('cm-header-icon');
  if (headerIcon) headerIcon.textContent = '🎮';
  const subTitle = document.getElementById('cm-subtitle-text');
  if (subTitle) subTitle.textContent = 'Platform dooro si aad u bilowdo';
  document.getElementById('cm-prize-preview').style.display = 'none';
  document.querySelectorAll('.cm-game-btn').forEach(b => b.classList.remove('selected'));
  document.querySelectorAll('.cm-stake-pill').forEach(b => b.classList.remove('selected'));
  if (stakeEl) stakeEl.value = '';
}

window.cmSelectGame = function(gameId, emoji, name) {
  document.getElementById('cm_platform').value = gameId;
  document.querySelectorAll('.cm-game-btn').forEach(b =>
    b.classList.toggle('selected', b.dataset.game === gameId));
  const icon = document.getElementById('cm-header-icon');
  if (icon) { icon.textContent = emoji; icon.style.filter = 'drop-shadow(0 0 16px rgba(0,230,118,.6))'; }
  const sub = document.getElementById('cm-subtitle-text');
  if (sub) sub.textContent = name + ' — Match abuur';
  const err = document.getElementById('cm_platform_err');
  if (err) err.textContent = '';
};

window.cmSelectStake = function(amount, el) {
  const input = document.getElementById('cm_stake');
  if (input) { input.value = amount; input.dispatchEvent(new Event('input')); }
  document.querySelectorAll('.cm-stake-pill').forEach(b => b.classList.remove('selected'));
  el.classList.add('selected');
};

function updatePrizePreview() {
  const stake   = parseInt(document.getElementById('cm_stake')?.value) || 0;
  const preview = document.getElementById('cm-prize-preview');
  const stakeEl = document.getElementById('cm-prize-stake');
  const winEl   = document.getElementById('cm-prize-win');
  if (!preview) return;
  if (stake < 1) { preview.style.display = 'none'; return; }
  preview.style.display = '';
  const fmt = window.sosFormat || (n => n.toLocaleString());
  if (stakeEl) stakeEl.textContent = fmt(stake) + ' SOS';
  if (winEl)   winEl.textContent   = fmt(stake * 2) + ' SOS';
  // Deselect stake pills if manual input
  const anyMatch = [...document.querySelectorAll('.cm-stake-pill')]
    .some(b => parseInt(b.dataset.stake) === stake);
  if (!anyMatch) document.querySelectorAll('.cm-stake-pill').forEach(b => b.classList.remove('selected'));
}

// ── 20. CREATE MATCH ───────────────────────────────────────
async function handleCreateMatch(e) {
  e.preventDefault();
  if (!requireOnline() || !currentUser) return;
  const platform    = document.getElementById('cm_platform')?.value;
  const stakeAmount = parseInt(document.getElementById('cm_stake')?.value) || 0;
  const title       = document.getElementById('cm_title')?.value.trim()    || '';
  const username    = document.getElementById('cm_username')?.value.trim() || '';
  const btn         = document.getElementById('btn_create_match');
  clearErrors('create-match-form');

  // Load settings for validation
  const settings = await loadGameSettings();
  const minStake = settings.minStake || 8000;
  const maxStake = settings.maxStake || 0;

  let valid = true;
  if (!platform)   { showError('cm_platform', 'Game dooro'); valid = false; }
  if (!username)   { showError('cm_username', 'Game-ka magacaaga geli'); valid = false; }
  if (stakeAmount < minStake) { showError('cm_stake', `Ugu yaraan ${(minStake/1000).toFixed(0)}K SOS`); valid = false; }
  if (maxStake > 0 && stakeAmount > maxStake) { showError('cm_stake', `Ugu badan ${(maxStake/1000).toFixed(0)}K SOS`); valid = false; }
  if ((currentUserData?.sosBalance||0) < stakeAmount) { showError('cm_stake', 'Lacag kuma filna'); valid = false; }
  if (!valid) return;
  setLoading(btn, true);
  try {
    await runTransaction(db, async tx => {
      const userRef  = doc(db, 'users', currentUser.uid);
      const userSnap = await tx.get(userRef);
      const user     = userSnap.data();
      if ((user.sosBalance||0) < stakeAmount) throw new Error('Lacag kuma filna');
      const matchRef = doc(collection(db, 'matches'));
      const matchId  = matchRef.id;
      tx.set(matchRef, {
        id: matchId, title: title || platform + ' Match', platform, stakeAmount,
        createdBy: currentUser.uid, createdByUsername: username,
        joinedBy: null, joinedByUsername: null, status: 'open', winnerId: null,
        result: { createdBy_claim: null, joinedBy_claim: null, dispute: false, screenshotBy: null },
        createdAt: serverTimestamp(), completedAt: null, lockedAt: null
      });
      tx.update(userRef, {
        sosBalance: (user.sosBalance||0) - stakeAmount,
        escrowSOS:  (user.escrowSOS||0)  + stakeAmount
      });
      tx.set(doc(collection(db, 'transactions')), {
        userId: currentUser.uid, type: 'escrow_lock', sos: -stakeAmount,
        relatedMatch: matchId, createdAt: serverTimestamp(), meta: { action: 'create', matchId }
      });
    });
    await loadUserData(currentUser.uid);
    closeModal('create-match-modal');
    showToast('✅ Match la abuuray! 🎮', 'success');
    ['cm_platform','cm_stake','cm_title','cm_username'].forEach(id => {
      const el = document.getElementById(id);
      if (el) el.value = '';
    });
  } catch (err) {
    setLoading(btn, false);
    showToast(err.message, 'error');
  }
}

// ── 21. AI SCREENSHOT ANALYSIS ────────────────────────────
async function setMatchWinner(matchId, winnerUid, m) {
  const loserUid = winnerUid === m.createdBy ? m.joinedBy : m.createdBy;
  const prize    = (m.stakeAmount||0) * 2;
  await runTransaction(db, async tx => {
    const mRef = doc(db, 'matches', matchId);
    const wRef = doc(db, 'users', winnerUid);
    const lRef = doc(db, 'users', loserUid);
    const [wSnap, lSnap] = await Promise.all([tx.get(wRef), tx.get(lRef)]);
    tx.update(mRef, { winnerId: winnerUid, status: 'done', completedAt: serverTimestamp() });
    tx.update(wRef, {
      sosBalance: (wSnap.data().sosBalance||0) + prize,
      escrowSOS:  Math.max(0, (wSnap.data().escrowSOS||0) - m.stakeAmount)
    });
    tx.update(lRef, { escrowSOS: Math.max(0, (lSnap.data().escrowSOS||0) - m.stakeAmount) });
    tx.set(doc(collection(db, 'transactions')), { userId: winnerUid, type: 'match_win',  sos: +prize,         relatedMatch: matchId, createdAt: serverTimestamp(), meta: { matchId, loserUid } });
    tx.set(doc(collection(db, 'transactions')), { userId: loserUid,  type: 'match_loss', sos: -m.stakeAmount, relatedMatch: matchId, createdAt: serverTimestamp(), meta: { matchId, winnerUid } });
  });
}

window.analyzeScreenshot = async function(matchId, file, myUid) {
  if (!file || !requireOnline()) return;
  showToast('📤 Screenshot-ka la soo gelayaa...', 'info');
  try {
    // 1. Upload to imgbb first
    let imgData = null;
    try {
      imgData = await uploadToImgbb(file, `match_${matchId}_${Date.now()}`);
    } catch(uploadErr) {
      console.warn('imgbb upload failed, continuing without URL:', uploadErr.message);
    }

    // 2. Convert to base64 for AI analysis
    const base64 = await new Promise((res, rej) => {
      const reader = new FileReader();
      reader.onload  = () => res(reader.result.split(',')[1]);
      reader.onerror = () => rej(new Error('File akhrinta ku guuldareysatay'));
      reader.readAsDataURL(file);
    });

    showToast('🤖 AI screenshot-ka falanqaynaya...', 'info');

    const mSnap = await getDoc(doc(db, 'matches', matchId));
    if (!mSnap.exists()) { showToast('Match la ma helin', 'error'); return; }
    const m          = mSnap.data();
    const isCreator  = myUid === m.createdBy;
    const myUsername  = isCreator ? (m.createdByUsername||'Player 1') : (m.joinedByUsername||'Player 2');
    const oppUsername = isCreator ? (m.joinedByUsername||'Player 2')  : (m.createdByUsername||'Player 1');
    const oppUid      = isCreator ? m.joinedBy : m.createdBy;
    if (m.status !== 'locked') { showToast('Match live ma ahan', 'error'); return; }
    if (m.winnerId)             { showToast('Winner horey la dejiyay', 'error'); return; }

    // 3. AI analysis
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: 'claude-sonnet-4-20250514', max_tokens: 300,
        messages: [{ role: 'user', content: [
          { type: 'image', source: { type: 'base64', media_type: file.type, data: base64 } },
          { type: 'text', text: `This is a game result screenshot from a 1v1 match.\nPlayer 1: "${myUsername}"\nPlayer 2: "${oppUsername}"\nReply ONLY with JSON: {"winner":"player1","score_p1":0,"score_p2":0,"confidence":"high"}\nwinner: "player1" if ${myUsername} won, "player2" if ${oppUsername} won, "unclear" if cannot determine\nconfidence: "high" if clearly visible, "low" if unclear` }
        ]}]
      })
    });
    const data   = await response.json();
    const raw    = data.content?.[0]?.text || '{}';
    const result = JSON.parse(raw.replace(/```json|```/g, '').trim());

    // 4. Save screenshot URL + AI result to match doc
    const screenshotPatch = {
      'result.screenshotBy':  myUid,
      'result.screenshotUrl': imgData?.url   || null,
      'result.screenshotThumb': imgData?.thumb || null,
      'result.aiResult':      result,
      'result.analyzedAt':    serverTimestamp()
    };

    if (result.confidence === 'high' && result.winner !== 'unclear') {
      const winnerUid = result.winner === 'player1' ? myUid : oppUid;
      // Save screenshot url before finalizing
      await updateDoc(doc(db, 'matches', matchId), screenshotPatch);
      await setMatchWinner(matchId, winnerUid, m);
      const isIWon = winnerUid === myUid;
      showToast(isIWon ? '🏆 Adaa guuleystay! SOS la siiyay!' : '💸 Waan khasaaray. Ciyaarta xiga!', isIWon ? 'success' : 'error');
      closeModal('match-modal');
      await loadUserData(currentUser.uid);
    } else {
      await updateDoc(doc(db, 'matches', matchId), {
        ...screenshotPatch,
        status: 'dispute', 'result.dispute': true,
      });
      await setDoc(doc(collection(db, 'disputes')), {
        matchId, submittedBy: myUid,
        screenshotUrl: imgData?.url || null,
        aiResult: result, createdAt: serverTimestamp()
      });
      showToast("⚠️ Screenshot-ka cad ma ahayn — Admin ayaa go'aan qaadanaya", 'warning');
      closeModal('match-modal');
    }
  } catch (err) {
    console.error('analyzeScreenshot:', err);
    showToast('Screenshot-ka falanqaynta ku guuldareysatay: ' + err.message, 'error');
  }
};

// ── 22a. DEPOSIT REQUEST ───────────────────────────────────
async function handleDeposit(e) {
  e.preventDefault();
  if (!requireOnline() || !currentUser) return;
  const amount   = parseFloat(document.getElementById('dep_amount')?.value)   || 0;
  const phone    = document.getElementById('dep_phone')?.value.trim()         || '';
  const provider = document.getElementById('dep_provider')?.value             || '';
  const btn      = document.getElementById('btn_deposit');
  clearErrors('deposit-form');
  let valid = true;
  if (amount < 1 || amount > 1000) { showError('dep_amount',   'Qadarka $1–$1000'); valid = false; }
  if (!validatePhone(phone))        { showError('dep_phone',    'Lambarka sax geli'); valid = false; }
  if (!provider)                    { showError('dep_provider', 'Provider dooro');    valid = false; }
  if (!valid) return;
  const sosAmount  = Math.floor(amount * (window._sosRate||32000));
  const cleanPhone = phone.replace('+','').replace(/\s/g,'');
  const amtMillis  = Math.round(amount * 1000);
  const ussdMap    = {
    Hormuud: `*712*${cleanPhone}*${amtMillis}#`,
    Somnet:  `*888*1*${cleanPhone}*${amtMillis}#`,
    Somtel:  `*668*${cleanPhone}*${amtMillis}#`
  };
  const ussdCode = ussdMap[provider] || `*000*${cleanPhone}*${amtMillis}#`;
  setLoading(btn, true);
  try {
    await addDoc(collection(db, 'deposit_requests'), {
      userId: currentUser.uid, amountUSD: amount, sosAmount,
      phoneSentFrom: phone, company: provider, ussdCode,
      status: 'pending', createdAt: serverTimestamp(),
      reviewedBy: null, reviewedAt: null
    });
    setLoading(btn, false);
    const fmt = window.sosFormat || (n => n.toLocaleString());
    const ussdEl     = document.getElementById('ussd-code-display');
    const ussdAmount = document.getElementById('ussd-amount-display');
    if (ussdEl)     ussdEl.textContent     = ussdCode;
    if (ussdAmount) ussdAmount.textContent = `$${amount} → ${fmt(sosAmount)} SOS`;
    closeModal('deposit-modal');
    setTimeout(() => openModal('ussd-modal'), 200);
  } catch (err) {
    setLoading(btn, false);
    showToast('Khalad: ' + err.message, 'error');
  }
}

// ── 22b. SEND SOS ──────────────────────────────────────────
async function handleSendCoins(e) {
  e.preventDefault();
  if (!requireOnline() || !currentUser) return;
  const recipientId = document.getElementById('send_recipient')?.value.trim() || '';
  const sendAmount  = parseInt(document.getElementById('send_amount')?.value)  || 0;
  const btn         = document.getElementById('btn_send_coins');
  clearErrors('send-coins-form');
  let valid = true;
  if (!recipientId)                                      { showError('send_recipient', 'UID-ka geli'); valid = false; }
  if (recipientId === currentUser.uid)                   { showError('send_recipient', 'Adiga nafta kuu diri kartid'); valid = false; }
  if (sendAmount < 1)                                    { showError('send_amount', 'Tiro sax ah geli'); valid = false; }
  if (sendAmount > (currentUserData?.sosBalance||0))     { showError('send_amount', 'Lacag kuma filna'); valid = false; }
  if (!valid) return;
  setLoading(btn, true);
  try {
    await runTransaction(db, async tx => {
      const senderRef    = doc(db, 'users', currentUser.uid);
      const recipientRef = doc(db, 'users', recipientId);
      const [sSnap, rSnap] = await Promise.all([tx.get(senderRef), tx.get(recipientRef)]);
      if (!rSnap.exists()) throw new Error('Isticmaalaha la ma helin');
      const sender = sSnap.data();
      if ((sender.sosBalance||0) < sendAmount) throw new Error('Lacag kuma filna');
      tx.update(senderRef,    { sosBalance: (sender.sosBalance||0) - sendAmount });
      tx.update(recipientRef, { sosBalance: (rSnap.data().sosBalance||0) + sendAmount });
      tx.set(doc(collection(db,'transactions')), { userId: currentUser.uid, type:'send',    sos: -sendAmount, relatedMatch: null, createdAt: serverTimestamp(), meta: { to: recipientId } });
      tx.set(doc(collection(db,'transactions')), { userId: recipientId,     type:'receive', sos: +sendAmount, relatedMatch: null, createdAt: serverTimestamp(), meta: { from: currentUser.uid } });
    });
    await loadUserData(currentUser.uid);
    closeModal('send-modal');
    const fmt = window.sosFormat || (n => n.toLocaleString());
    showToast(`✅ ${fmt(sendAmount)} SOS la diray!`, 'success');
    document.getElementById('send_recipient').value = '';
    document.getElementById('send_amount').value    = '';
  } catch (err) {
    setLoading(btn, false);
    showToast(err.message, 'error');
  }
}

// ── 23. TRANSACTION HISTORY ────────────────────────────────
function loadTransactionHistory(container) {
  if (!container || !currentUser) return;
  container.innerHTML = Array(4).fill(`
    <div class="tx-item">
      <div class="skeleton" style="width:40px;height:40px;border-radius:8px;flex-shrink:0"></div>
      <div style="flex:1">
        <div class="skeleton sk-line" style="width:70%"></div>
        <div class="skeleton sk-line" style="width:40%"></div>
      </div>
    </div>`).join('');
  const q = query(
    collection(db, 'transactions'),
    where('userId','==', currentUser.uid),
    orderBy('createdAt','desc'), limit(30)
  );
  onSnapshot(q, snap => {
    if (snap.empty) {
      container.innerHTML = `<p class="text-center text-muted p-md">Wax transaction ah ma jiro weli</p>`;
      return;
    }
    const icons  = { deposit_approved:'💰', escrow_lock:'🔒', escrow_release:'🔓', match_win:'🏆', win:'🏆', match_loss:'💸', send:'📤', receive:'📥', refund:'↩️' };
    const labels = { deposit_approved:'Lacag la keenay', escrow_lock:'Match escrow', escrow_release:'Escrow la furay', match_win:'Guul Match', win:'Guul Match', match_loss:'Khasaaro Match', send:'La diray', receive:'La helay', refund:'Dib loo celiyay' };
    const fmt = window.sosFormat || (n => n.toLocaleString());
    container.innerHTML = snap.docs.map(d => {
      const t        = d.data();
      const isCredit = t.sos > 0;
      const time     = t.createdAt?.toDate ? t.createdAt.toDate().toLocaleDateString('so-SO') : 'Dhawaan';
      return `
        <div class="tx-item" role="listitem">
          <div class="tx-icon">${icons[t.type] || '💫'}</div>
          <div class="tx-info">
            <div class="tx-title">${labels[t.type] || t.type}</div>
            <div class="tx-date">${time}</div>
          </div>
          <div class="tx-amount ${isCredit ? 'credit' : 'debit'}">
            ${isCredit ? '+' : ''}${fmt(t.sos||0)} SOS
          </div>
        </div>`;
    }).join('');
  });
}

// ── 24. ADMIN: LOAD DEPOSIT REQUESTS ──────────────────────
function loadDepositRequests(container) {
  if (!container) return;
  const adminRoles = ['administrator','owner','partner_manager'];
  if (!adminRoles.includes(currentUserData?.role)) return;
  const q = query(collection(db,'deposit_requests'), where('status','==','pending'), orderBy('createdAt','desc'), limit(20));
  onSnapshot(q, snap => {
    const fmt = window.sosFormat || (n => n.toLocaleString());
    if (snap.empty) { container.innerHTML = `<p class="text-muted" style="font-size:13px">✅ Pending requests ma jiro</p>`; return; }
    container.innerHTML = snap.docs.map(d => {
      const r = d.data();
      return `
        <div class="deposit-req-card">
          <div class="deposit-req-meta">
            <span class="deposit-req-coins">${fmt(r.sosAmount||0)} SOS</span>
            <span class="pending-badge">Sugaysa</span>
          </div>
          <div style="font-size:13px;color:var(--text-secondary);margin-bottom:4px">
            💵 $${r.amountUSD} · ${r.company} · ${r.phoneSentFrom}
          </div>
          <div style="font-size:11px;color:var(--text-muted);font-family:monospace;margin-bottom:10px;word-break:break-all">
            ${r.ussdCode}
          </div>
          <div class="grid-2">
            <button class="btn btn-primary btn-sm" onclick="adminApproveDeposit('${d.id}','${r.userId}',${r.sosAmount})">✅ Ogolow</button>
            <button class="btn btn-danger btn-sm"  onclick="adminRejectDeposit('${d.id}')">❌ Diid</button>
          </div>
        </div>`;
    }).join('');
  });
}

// ── 25. ADMIN: APPROVE DEPOSIT ─────────────────────────────
window.adminApproveDeposit = async function(reqId, userId, sosAmount) {
  const fmt = window.sosFormat || (n => n.toLocaleString());
  if (!confirm(`✅ Deposit ogolaan?\n${fmt(sosAmount)} SOS\n$${(sosAmount/32000).toFixed(2)}`)) return;
  if (!requireOnline()) return;
  try {
    await runTransaction(db, async tx => {
      const reqRef  = doc(db,'deposit_requests', reqId);
      const userRef = doc(db,'users', userId);
      const [rSnap, uSnap] = await Promise.all([tx.get(reqRef), tx.get(userRef)]);
      if (!rSnap.exists())                   throw new Error('Request la ma helin');
      if (rSnap.data().status !== 'pending') throw new Error('Horey loo xukumay');
      tx.update(reqRef,  { status:'approved', reviewedBy: currentUser.uid, reviewedAt: serverTimestamp() });
      tx.update(userRef, { sosBalance: (uSnap.data().sosBalance||0) + sosAmount });
      tx.set(doc(collection(db,'transactions')), { userId, type:'deposit_approved', sos: sosAmount, relatedMatch: null, createdAt: serverTimestamp(), meta: { reqId, approvedBy: currentUser.uid } });
      tx.set(doc(collection(db,'adminLogs')),    { action:'approve_deposit', adminUid: currentUser.uid, targetUserId: userId, reqId, sosAmount, createdAt: serverTimestamp() });
    });
    showToast('✅ Deposit la ogolaaday! SOS waa la gudbiyay.', 'success');
  } catch (err) {
    showToast('Khalad: ' + err.message, 'error');
  }
};

window.adminRejectDeposit = async function(reqId) {
  if (!confirm('❌ Deposit-kan diidid?')) return;
  if (!requireOnline()) return;
  try {
    await updateDoc(doc(db,'deposit_requests', reqId), { status:'rejected', reviewedBy: currentUser.uid, reviewedAt: serverTimestamp() });
    await addDoc(collection(db,'adminLogs'), { action:'reject_deposit', adminUid: currentUser.uid, reqId, createdAt: serverTimestamp() });
    showToast('Deposit la diidiy', 'info');
  } catch (err) {
    showToast('Khalad: ' + err.message, 'error');
  }
};

// ── 26. ADMIN: SET WINNER ──────────────────────────────────
window.adminSetWinner = async function(matchId, winnerUid) {
  if (!confirm(`🏆 Winner set garee?\nUID: ${winnerUid.slice(0,16)}...`)) return;
  if (!requireOnline()) return;
  try {
    await runTransaction(db, async tx => {
      const matchRef  = doc(db,'matches', matchId);
      const matchSnap = await tx.get(matchRef);
      if (!matchSnap.exists()) throw new Error('Match la ma helin');
      const m = matchSnap.data();
      if (m.status !== 'locked') throw new Error('Match weli locked ma ahan');
      if (m.winnerId)            throw new Error('Winner horey ayaa la dejiyay');
      if (!m.joinedBy)           throw new Error('Labo ciyaartoy ma jiraan weli');
      const loserUid  = winnerUid === m.createdBy ? m.joinedBy : m.createdBy;
      const prize     = (m.stakeAmount||0) * 2;
      const winnerRef = doc(db,'users', winnerUid);
      const loserRef  = doc(db,'users', loserUid);
      const [wSnap, lSnap] = await Promise.all([tx.get(winnerRef), tx.get(loserRef)]);
      tx.update(matchRef,  { winnerId: winnerUid, status:'done', completedAt: serverTimestamp() });
      tx.update(winnerRef, { sosBalance: (wSnap.data().sosBalance||0) + prize, escrowSOS: Math.max(0,(wSnap.data().escrowSOS||0) - m.stakeAmount) });
      tx.update(loserRef,  { escrowSOS: Math.max(0,(lSnap.data().escrowSOS||0) - m.stakeAmount) });
      tx.set(doc(collection(db,'transactions')), { userId: winnerUid, type:'match_win',  sos: +prize,         relatedMatch: matchId, createdAt: serverTimestamp(), meta: { matchId, loserUid } });
      tx.set(doc(collection(db,'transactions')), { userId: loserUid,  type:'match_loss', sos: -m.stakeAmount, relatedMatch: matchId, createdAt: serverTimestamp(), meta: { matchId, winnerUid } });
      tx.set(doc(collection(db,'adminLogs')),    { action:'set_winner', adminUid: currentUser.uid, matchId, winnerUid, loserUid, prize, createdAt: serverTimestamp() });
    });
    showToast('🏆 Winner la dejiyay! SOS waa la qaybiyay.', 'success');
  } catch (err) {
    showToast('Khalad: ' + err.message, 'error');
  }
};

// ── 27. FILTER CHIPS ───────────────────────────────────────
function initFilterChips(matchesContainer) {
  document.querySelectorAll('.filter-chip').forEach(chip => {
    chip.addEventListener('click', () => {
      document.querySelectorAll('.filter-chip').forEach(c => { c.classList.remove('active'); c.setAttribute('aria-selected','false'); });
      chip.classList.add('active');
      chip.setAttribute('aria-selected','true');
      loadMatches(matchesContainer, chip.dataset.filter || 'all');
    });
  });
}

// ── 28. PROFILE STATS ─────────────────────────────────────
async function loadProfileStats(uid) {
  try {
    const [createdSnap, joinedSnap, winsSnap] = await Promise.all([
      getDocs(query(collection(db,'matches'), where('createdBy','==',uid), limit(50))),
      getDocs(query(collection(db,'matches'), where('joinedBy','==',uid),  limit(50))),
      getDocs(query(collection(db,'transactions'), where('userId','==',uid), where('type','==','match_win'), limit(100)))
    ]);
    const createdIds   = new Set(createdSnap.docs.map(d => d.id));
    const totalMatches = createdSnap.size + joinedSnap.docs.filter(d => !createdIds.has(d.id)).length;
    const fmt = window.sosFormat || (n => n.toLocaleString());
    const statCoins   = document.getElementById('stat-coins');
    const statMatches = document.getElementById('stat-matches');
    const statWins    = document.getElementById('stat-wins');
    const statEscrow  = document.getElementById('stat-escrow');
    if (statCoins)   statCoins.textContent   = fmt(currentUserData?.sosBalance||0);
    if (statMatches) statMatches.textContent = totalMatches;
    if (statWins)    statWins.textContent    = winsSnap.size;
    if (statEscrow)  statEscrow.textContent  = fmt(currentUserData?.escrowSOS||0);
  } catch (err) {
    console.error('loadProfileStats:', err);
  }
}

// ── 29. PROFILE FILL UI ────────────────────────────────────
function fillProfileUI() {
  if (!currentUserData) return;
  const u = currentUserData;
  const initials = (u.fullName||'U').split(' ').map(w=>w[0]).join('').toUpperCase().slice(0,2);
  const set = (id, val) => { const el = document.getElementById(id); if (el) el.textContent = val; };
  set('profile-name-display',  u.fullName || '—');
  set('profile-email-display', u.email    || '—');
  set('info-fullname',         u.fullName || '—');
  set('info-email',            u.email    || '—');
  set('info-phone',            u.phone    || 'La ma gelin');
  set('profile-uid-display',  'UID: ' + (u.uid||'').slice(0,18) + '...');
  const avatarEl = document.getElementById('profile-avatar-display');
  if (avatarEl) avatarEl.textContent = initials;
  const infoDate = document.getElementById('info-createdat');
  if (infoDate && u.createdAt?.toDate) infoDate.textContent = u.createdAt.toDate().toLocaleDateString('so-SO');
  const roleBadge = document.getElementById('profile-role-badge');
  if (roleBadge) {
    const roleConfig = {
      owner:           { cls:'role-badge-owner',   icon:'👑', label:'Owner'           },
      administrator:   { cls:'role-badge-admin',   icon:'🛡️', label:'Administrator'   },
      partner_manager: { cls:'role-badge-admin',   icon:'🤝', label:'Partner Manager' },
      support:         { cls:'role-badge-support', icon:'🎧', label:'Support'         },
      agent:           { cls:'role-badge-support', icon:'📋', label:'Agent'           },
      user:            { cls:'role-badge-user',    icon:'👤', label:'User'            }
    };
    const cfg = roleConfig[u.role] || roleConfig.user;
    roleBadge.className   = `role-badge ${cfg.cls}`;
    roleBadge.textContent = `${cfg.icon} ${cfg.label}`;
  }
  const editName  = document.getElementById('edit_fullName');
  const editPhone = document.getElementById('edit_phone');
  if (editName)  editName.placeholder  = u.fullName || 'Magacaaga cusub';
  if (editPhone) editPhone.placeholder = u.phone    || '+252...';

  // ── Admin Tools section visibility ──────────────────────
  const adminRoles = ['owner','administrator','partner_manager','support','agent'];
  const isAdmin    = adminRoles.includes(u.role);
  const adminSection = document.getElementById('admin-menu-section');
  if (adminSection) adminSection.classList.toggle('hidden', !isAdmin);

  // Admin Dashboard — owner + administrator only
  const canSeeAdminDash = ['owner','administrator'].includes(u.role);
  document.querySelectorAll('.settings-item.admin-only').forEach(el => {
    el.classList.toggle('hidden', !canSeeAdminDash);
  });

  // User Management — owner only
  const userMgmtEl = document.getElementById('menu_admin_users');
  if (userMgmtEl) userMgmtEl.classList.toggle('hidden', u.role !== 'owner');
}

// ── 30. MAIN DOMContentLoaded ──────────────────────────────
document.addEventListener('DOMContentLoaded', async () => {

  const page = window.location.pathname.split('/').pop() || 'index.html';

  document.querySelectorAll('.modal-overlay').forEach(overlay => {
    overlay.addEventListener('click', e => {
      if (e.target === overlay) closeModal(overlay.id);
    });
  });

  // ════════════════════════════════════════════════════════
  // INDEX.HTML — Login / Register
  // ════════════════════════════════════════════════════════
  if (page === 'index.html' || page === '') {
    // Check for Google redirect result (after signInWithRedirect returns)
    try {
      const rCred = await getRedirectResult(auth);
      if (rCred?.user) { await _handleGoogleCred(rCred); return; }
    } catch(e) { /* no redirect pending — normal */ }

    // authGuard(false) → if user logged in, redirects to dashboard and returns user obj
    // if no user, returns null and we show login page
    const user = await authGuard(false, 'dashboard.html');
    if (user) return; // redirect already fired — stop all execution
    // ── No user logged in — wire up login page ──
    initPasswordToggles();
    document.getElementById('login-form')    ?.addEventListener('submit', handleLogin);
    document.getElementById('register-form') ?.addEventListener('submit', handleSignup);
    document.getElementById('btn_google')     ?.addEventListener('click',  handleGoogleSignIn);
    document.getElementById('btn_google_reg') ?.addEventListener('click',  handleGoogleSignIn);
    document.getElementById('btn_forgot_pw')  ?.addEventListener('click',  window.handlePasswordReset);
    document.querySelectorAll('.tab-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const tab = btn.dataset.tab;
        document.querySelectorAll('.tab-btn').forEach(b => { b.classList.remove('active'); b.setAttribute('aria-selected','false'); });
        btn.classList.add('active');
        btn.setAttribute('aria-selected','true');
        document.querySelectorAll('.tab-content').forEach(c => { c.classList.toggle('hidden', c.dataset.tab !== tab); });
      });
    });
    return;
  }

  // ════════════════════════════════════════════════════════
  // DASHBOARD.HTML
  // ════════════════════════════════════════════════════════
  if (page === 'dashboard.html') {
    await authGuard(true);
    const matchesContainer = document.getElementById('matches-list');
    loadMatches(matchesContainer, 'all');
    initFilterChips(matchesContainer);
    document.getElementById('btn_open_create')  ?.addEventListener('click',  () => { _gameSettings = null; openModal('create-match-modal'); initCreateModal(); });
    document.getElementById('create-match-form') ?.addEventListener('submit', handleCreateMatch);
    // Prize preview live update
    document.getElementById('cm_stake')?.addEventListener('input', updatePrizePreview);
    document.getElementById('btn_logout')        ?.addEventListener('click',  handleLogout);
    loadDepositRequests(document.getElementById('admin-deposits-container'));
    const pendingJoin = localStorage.getItem('pending_join');
    if (pendingJoin) { localStorage.removeItem('pending_join'); setTimeout(() => openMatchModal(pendingJoin), 600); }
    if (localStorage.getItem('open_create') === '1') { localStorage.removeItem('open_create'); setTimeout(() => { _gameSettings = null; openModal('create-match-modal'); initCreateModal(); }, 400); }
    return;
  }

  // ════════════════════════════════════════════════════════
  // WALLET.HTML
  // ════════════════════════════════════════════════════════
  if (page === 'wallet.html') {
    await authGuard(true);
    const fmt = window.sosFormat || (n => n.toLocaleString());
    function updateWalletDisplay() {
      const bal = currentUserData?.sosBalance || 0;
      const esc = currentUserData?.escrowSOS  || 0;
      const coinsEl  = document.getElementById('wallet-coin-balance');
      const escrowEl = document.getElementById('wallet-escrow-balance');
      const usdEl    = document.getElementById('wallet-usd-equiv');
      if (coinsEl)  coinsEl.textContent  = fmt(bal);
      if (escrowEl) escrowEl.textContent = fmt(esc);
      if (usdEl)    usdEl.textContent    = (bal / (window._sosRate||32000)).toFixed(2);
    }
    if (currentUser) {
      onSnapshot(doc(db,'users', currentUser.uid), snap => {
        if (snap.exists()) { currentUserData = snap.data(); window._ematch_userdata = currentUserData; updateWalletDisplay(); updateHeaderUI(); }
      });
    }
    updateWalletDisplay();
    loadTransactionHistory(document.getElementById('tx-list'));
    document.getElementById('btn_open_deposit')  ?.addEventListener('click',  () => openModal('deposit-modal'));
    document.getElementById('deposit-form')       ?.addEventListener('submit', handleDeposit);
    document.getElementById('btn_open_send')      ?.addEventListener('click',  () => openModal('send-modal'));
    document.getElementById('send-coins-form')    ?.addEventListener('submit', handleSendCoins);
    document.getElementById('btn_logout')         ?.addEventListener('click',  handleLogout);
    document.getElementById('dep_amount')?.addEventListener('input', function() {
      const coins   = Math.floor((parseFloat(this.value)||0) * (window._sosRate||32000));
      const preview = document.getElementById('dep_preview_coins');
      const hint    = document.getElementById('dep_coins_preview');
      if (preview) preview.textContent = coins > 0 ? fmt(coins) : '—';
      if (hint)    hint.textContent    = coins > 0 ? ` ${fmt(coins)} SOS la helayaa` : 'SOS la helayo: —';
    });
    document.getElementById('btn_copy_ussd')?.addEventListener('click', () => {
      const code = document.getElementById('ussd-code-display')?.textContent;
      if (code) navigator.clipboard.writeText(code).then(() => showToast('✅ USSD code la koobiyay','success')).catch(() => showToast('Koobiyaynta waa fashilantay','error'));
    });
    return;
  }

  // ════════════════════════════════════════════════════════
  // PROFILE.HTML
  // ════════════════════════════════════════════════════════
  if (page === 'profile.html') {
    await authGuard(true);
    fillProfileUI();
    await loadProfileStats(currentUser.uid);
    onSnapshot(doc(db,'users', currentUser.uid), snap => {
      if (snap.exists()) {
        currentUserData = snap.data(); window._ematch_userdata = currentUserData;
        updateHeaderUI();
        // Re-run fillProfileUI so role-based sections (Admin Tools, User Management) always update
        fillProfileUI();
        const fmt = window.sosFormat || (n => n.toLocaleString());
        const statCoins  = document.getElementById('stat-coins');
        const statEscrow = document.getElementById('stat-escrow');
        if (statCoins)  statCoins.textContent  = fmt(currentUserData.sosBalance||0);
        if (statEscrow) statEscrow.textContent = fmt(currentUserData.escrowSOS||0);
      }
    });
    document.getElementById('btn_logout')?.addEventListener('click', handleLogout);
    document.getElementById('edit-profile-form')?.addEventListener('submit', async function(e) {
      e.preventDefault();
      const newName  = document.getElementById('edit_fullName')?.value.trim();
      const newPhone = document.getElementById('edit_phone')?.value.trim();
      const btn      = document.getElementById('btn_save_profile');
      document.getElementById('edit_fullName_err').textContent = '';
      document.getElementById('edit_phone_err').textContent    = '';
      let valid = true;
      if (newName  && newName.length < 2)     { document.getElementById('edit_fullName_err').textContent='Ugu yaraan 2 xaraf'; valid=false; }
      if (newPhone && !validatePhone(newPhone)){ document.getElementById('edit_phone_err').textContent='Lambarka sax ma ahan'; valid=false; }
      if (!newName && !newPhone) { showToast('Wax bedel ah geli', 'error'); return; }
      if (!valid || !requireOnline()) return;
      setLoading(btn, true);
      try {
        const updates = {};
        if (newName)  updates.fullName = newName;
        if (newPhone) updates.phone    = newPhone;
        await updateDoc(doc(db,'users', currentUser.uid), updates);
        Object.assign(currentUserData, updates);
        window._ematch_userdata = currentUserData;
        fillProfileUI(); updateHeaderUI();
        const editFN = document.getElementById('edit_fullName');
        const editPH = document.getElementById('edit_phone');
        if (editFN) editFN.value = '';
        if (editPH) editPH.value = '';
        showToast('✅ Xogta waa la keydiyay!', 'success');
      } catch (err) {
        showToast('Khalad: ' + err.message, 'error');
      } finally {
        setLoading(btn, false);
      }
    });
    document.getElementById('menu_reset_pw')?.addEventListener('click', async () => {
      const email = currentUserData?.email;
      if (!email) { showToast('Email la ma helin','error'); return; }
      if (!requireOnline()) return;
      try { await sendPasswordResetEmail(auth, email); showToast('✅ Password reset email la diray!','success'); }
      catch (err) { showToast('Khalad: ' + err.message,'error'); }
    });
    document.getElementById('menu_share')?.addEventListener('click', () => {
      if (navigator.share) { navigator.share({ title:'eMatch', text:'Kaalay eMatch ku ciyaar! 🎮', url: window.location.origin }).catch(()=>{}); }
      else navigator.clipboard.writeText(window.location.origin).then(() => showToast('✅ Link la koobiyay!','success'));
    });
    document.getElementById('menu_about')?.addEventListener('click', () => openModal('about-modal'));
    window.copyUID = function() {
      const uid = currentUser?.uid;
      if (uid) navigator.clipboard.writeText(uid).then(() => showToast('✅ UID la koobiyay!','success')).catch(() => showToast('Koobiyaynta waa fashilantay','error'));
    };
    return;
  }

  // ════════════════════════════════════════════════════════
  // ADMIN.HTML
  // ════════════════════════════════════════════════════════
  if (page === 'admin.html') {
    await authGuard(true);
    const adminRoles = ['administrator','owner','partner_manager'];
    if (!adminRoles.includes(currentUserData?.role)) {
      showToast('Admin access ma lihid', 'error');
      setTimeout(() => window.location.replace('dashboard.html'), 1500);
      return;
    }
    onSnapshot(doc(db,'users', currentUser.uid), snap => {
      if (snap.exists()) { currentUserData = snap.data(); window._ematch_userdata = currentUserData; updateHeaderUI(); }
    });
    return;
  }

  // ════════════════════════════════════════════════════════
  // MATCHES.HTML
  // ════════════════════════════════════════════════════════
  if (page === 'matches.html') {
    await authGuard(true);
    // Script module-keeda gaar ah ayaa matches.html xukuma
    // window._ematch_* globals ayaa la wadaagaa
  }

});
