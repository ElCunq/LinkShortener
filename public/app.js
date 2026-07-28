// LinkShortener Frontend Client Application (Live Production Mode)

const API_BASE = '/api/v1';

let state = {
  accessToken: localStorage.getItem('ls_access_token') || '',
  user: JSON.parse(localStorage.getItem('ls_user') || 'null'),
  domains: [],
  links: [],
  apiKeys: [],
  serverConfig: { admin_domain: window.location.hostname || 'localhost', system_domain: window.location.hostname || 'localhost' }
};

// DOM Elements
const mainContainer = document.getElementById('mainContainer');
const authBtn = document.getElementById('authBtn');
const logoutBtn = document.getElementById('logoutBtn');
const userEmailBadge = document.getElementById('userEmailBadge');
const authModal = document.getElementById('authModal');
const authForm = document.getElementById('authForm');
const authEmailInput = document.getElementById('authEmailInput');
const authPasswordInput = document.getElementById('authPasswordInput');
const registerSubmitBtn = document.getElementById('registerSubmitBtn');

const statTotalLinks = document.getElementById('statTotalLinks');
const statTotalDomains = document.getElementById('statTotalDomains');
const statTotalClicks = document.getElementById('statTotalClicks');
const statTotalApiKeys = document.getElementById('statTotalApiKeys');

const domainSelect = document.getElementById('domainSelect');
const createLinkForm = document.getElementById('createLinkForm');
const destUrlInput = document.getElementById('destUrlInput');
const customSlugInput = document.getElementById('customSlugInput');

const linksList = document.getElementById('linksList');
const addDomainForm = document.getElementById('addDomainForm');
const newHostnameInput = document.getElementById('newHostnameInput');
const domainsList = document.getElementById('domainsList');

const analyticsLinkSelect = document.getElementById('analyticsLinkSelect');
const deviceStatsList = document.getElementById('deviceStatsList');
const browserStatsList = document.getElementById('browserStatsList');
const referrerStatsList = document.getElementById('referrerStatsList');

const createApiKeyForm = document.getElementById('createApiKeyForm');
const apiKeyNameInput = document.getElementById('apiKeyNameInput');
const apiKeysList = document.getElementById('apiKeysList');

const apiKeyModal = document.getElementById('apiKeyModal');
const newApiKeyInput = document.getElementById('newApiKeyInput');
const copyApiKeyBtn = document.getElementById('copyApiKeyBtn');
const copyApiKeyBtnText = document.getElementById('copyApiKeyBtnText');

const qrModal = document.getElementById('qrModal');
const qrUrlDisplay = document.getElementById('qrUrlDisplay');
const qrImageDisplay = document.getElementById('qrImageDisplay');
const downloadQrBtn = document.getElementById('downloadQrBtn');

const toast = document.getElementById('toast');
const toastMessage = document.getElementById('toastMessage');

// Global Modal Control Functions
window.closeAuthModal = () => {
  if (state.accessToken && state.user && authModal) {
    authModal.classList.add('hidden');
  }
};

window.openAuthModal = () => {
  if (authModal) authModal.classList.remove('hidden');
};

window.closeApiKeyModal = () => {
  if (apiKeyModal) apiKeyModal.classList.add('hidden');
};

window.openApiKeyModal = () => {
  if (apiKeyModal) apiKeyModal.classList.remove('hidden');
};

window.closeQrModal = () => {
  if (qrModal) qrModal.classList.add('hidden');
};

window.openQrModal = () => {
  if (qrModal) qrModal.classList.remove('hidden');
};

// Toast Feedback Helper
function showToast(message, isError = false) {
  if (!toast || !toastMessage) return;
  toastMessage.textContent = message;
  toast.style.borderColor = isError ? 'rgba(244, 63, 94, 0.5)' : 'rgba(16, 185, 129, 0.5)';
  toast.classList.remove('translate-y-10', 'opacity-0', 'pointer-events-none');

  setTimeout(() => {
    toast.classList.add('translate-y-10', 'opacity-0', 'pointer-events-none');
  }, 3500);
}

// Robust Clipboard Copy Function
function copyToClipboard(text, btnElement = null) {
  if (!text) return;

  const performSuccessFeedback = () => {
    showToast('Copied to clipboard!');
    if (btnElement) {
      const originalText = btnElement.innerText;
      btnElement.innerText = 'Copied! ✓';
      setTimeout(() => {
        btnElement.innerText = originalText;
      }, 2000);
    }
  };

  if (navigator.clipboard && window.isSecureContext) {
    navigator.clipboard.writeText(text).then(performSuccessFeedback).catch(() => fallbackCopyText(text, performSuccessFeedback));
  } else {
    fallbackCopyText(text, performSuccessFeedback);
  }
}

function fallbackCopyText(text, callback) {
  const textArea = document.createElement('textarea');
  textArea.value = text;
  textArea.style.position = 'fixed';
  textArea.style.left = '-9999px';
  document.body.appendChild(textArea);
  textArea.focus();
  textArea.select();
  try {
    document.execCommand('copy');
    if (callback) callback();
  } catch (err) {
    alert('Failed to copy: ' + text);
  }
  document.body.removeChild(textArea);
}

window.copyText = (text) => copyToClipboard(text);

// Initialize App
document.addEventListener('DOMContentLoaded', async () => {
  window.closeApiKeyModal();
  window.closeQrModal();

  // Fetch dynamic server config (SYSTEM_DOMAIN, ADMIN_DOMAINS) from backend
  try {
    const configRes = await fetch(`${API_BASE}/config`);
    if (configRes.ok) {
      state.serverConfig = await configRes.json();
    }
  } catch (e) { /* use defaults */ }

  setupEventListeners();

  if (!state.accessToken || !state.user) {
    if (mainContainer) mainContainer.classList.add('hidden');
    window.openAuthModal();
  } else {
    if (mainContainer) mainContainer.classList.remove('hidden');
    window.closeAuthModal();
    updateUserHeader();
    await fetchAllData();
  }
});

function setupEventListeners() {
  // Tabs
  document.querySelectorAll('.tab-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
      document.querySelectorAll('.tab-content').forEach(c => c.classList.add('hidden'));

      const targetTab = e.currentTarget.getAttribute('data-tab');
      e.currentTarget.classList.add('active');
      document.getElementById(targetTab).classList.remove('hidden');
    });
  });

  // Auth Button
  if (authBtn) {
    authBtn.addEventListener('click', () => {
      window.openAuthModal();
    });
  }

  // Logout Button
  if (logoutBtn) {
    logoutBtn.addEventListener('click', () => {
      localStorage.removeItem('ls_access_token');
      localStorage.removeItem('ls_user');
      state.accessToken = '';
      state.user = null;
      state.domains = [];
      state.links = [];
      state.apiKeys = [];
      updateUserHeader();
      showToast('Signed out successfully.');
      window.openAuthModal();
    });
  }

  // Auth Form Submit (Login)
  if (authForm) {
    authForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      await loginUser(authEmailInput.value, authPasswordInput.value);
      window.closeAuthModal();
    });
  }

  // Register Submit
  if (registerSubmitBtn) {
    registerSubmitBtn.addEventListener('click', async () => {
      await registerUser(authEmailInput.value, authPasswordInput.value);
      window.closeAuthModal();
    });
  }

  // Shorten Link Form Submit
  if (createLinkForm) {
    createLinkForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      let domainId = domainSelect.value;
      const destinationUrl = destUrlInput.value;
      const customSlug = customSlugInput.value.trim() || undefined;
      const redirectType = parseInt(document.querySelector('input[name="redirectType"]:checked').value, 10);

      if (domainId === 'default_system' || !domainId) {
        if (state.domains.length > 0) {
          domainId = state.domains[0].id;
        } else {
          // Auto-create default system domain for 0-config instant link shortening
          const systemDomain = await apiPost('/domains', { hostname: state.serverConfig.system_domain });
          await fetchDomains();
          domainId = systemDomain.id;
        }
      }

      try {
        const res = await apiPost('/links', {
          domain_id: domainId,
          destination_url: destinationUrl,
          custom_slug: customSlug,
          redirect_type: redirectType
        });

        destUrlInput.value = '';
        customSlugInput.value = '';
        await fetchLinks();
        showToast(`Short link created: ${res.short_url}`);
      } catch (err) {
        showToast(err.message, true);
      }
    });
  }

  // Add Domain Form Submit
  if (addDomainForm) {
    addDomainForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const hostname = newHostnameInput.value.trim();

      try {
        await apiPost('/domains', { hostname });
        newHostnameInput.value = '';
        await fetchDomains();
        showToast(`Domain ${hostname} added successfully!`);
      } catch (err) {
        showToast(err.message, true);
      }
    });
  }

  // Create API Key Form Submit
  if (createApiKeyForm) {
    createApiKeyForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const name = apiKeyNameInput.value.trim();

      try {
        const res = await apiPost('/api-keys', { name, expires_in_days: 90 });
        apiKeyNameInput.value = '';
        
        if (newApiKeyInput) {
          newApiKeyInput.value = res.api_key;
        }
        
        window.openApiKeyModal();
        await fetchApiKeys();
      } catch (err) {
        showToast(err.message, true);
      }
    });
  }

  // Copy API Key Button Click
  if (copyApiKeyBtn && newApiKeyInput) {
    copyApiKeyBtn.addEventListener('click', () => {
      copyToClipboard(newApiKeyInput.value, copyApiKeyBtnText);
    });
  }

  if (analyticsLinkSelect) {
    analyticsLinkSelect.addEventListener('change', () => loadAnalyticsForSelectedLink());
  }
}

// --- API FETCH HELPERS ---
async function apiGet(path) {
  const res = await fetch(`${API_BASE}${path}`, {
    headers: { Authorization: `Bearer ${state.accessToken}` }
  });
  if (res.status === 401) {
    localStorage.removeItem('ls_access_token');
    state.accessToken = '';
    window.openAuthModal();
    throw new Error('Session expired. Please sign in.');
  }
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || data.verification_message || data.message || 'API Request failed');
  return data;
}

async function apiPost(path, body) {
  const res = await fetch(`${API_BASE}${path}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${state.accessToken}`
    },
    body: JSON.stringify(body)
  });
  if (res.status === 401) {
    localStorage.removeItem('ls_access_token');
    state.accessToken = '';
    window.openAuthModal();
    throw new Error('Session expired. Please sign in.');
  }
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || data.verification_message || data.message || 'API Request failed');
  return data;
}

async function apiDelete(path) {
  const res = await fetch(`${API_BASE}${path}`, {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${state.accessToken}` }
  });
  if (res.status === 401) {
    localStorage.removeItem('ls_access_token');
    state.accessToken = '';
    window.openAuthModal();
    throw new Error('Session expired. Please sign in.');
  }
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || data.verification_message || data.message || 'API Request failed');
  return data;
}

// --- AUTH LOGIC ---
async function loginUser(email, password) {
  try {
    const res = await fetch(`${API_BASE}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password })
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Login failed');

    state.accessToken = data.tokens.access_token;
    state.user = data.user;
    localStorage.setItem('ls_access_token', state.accessToken);
    localStorage.setItem('ls_user', JSON.stringify(state.user));

    updateUserHeader();
    await fetchAllData();
    showToast(`Signed in as ${state.user.email}`);
  } catch (err) {
    showToast(err.message, true);
  }
}

async function registerUser(email, password) {
  try {
    const res = await fetch(`${API_BASE}/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password })
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Registration failed');

    state.accessToken = data.tokens.access_token;
    state.user = data.user;
    localStorage.setItem('ls_access_token', state.accessToken);
    localStorage.setItem('ls_user', JSON.stringify(state.user));

    updateUserHeader();
    await fetchAllData();
    showToast('Account registered successfully!');
  } catch (err) {
    showToast(err.message, true);
  }
}

function updateUserHeader() {
  if (state.user && state.accessToken && userEmailBadge && authBtn && logoutBtn) {
    userEmailBadge.textContent = state.user.email;
    userEmailBadge.classList.remove('hidden');
    authBtn.classList.add('hidden');
    logoutBtn.classList.remove('hidden');
    if (mainContainer) mainContainer.classList.remove('hidden');
    if (authModal) authModal.classList.add('hidden');
  } else if (userEmailBadge && authBtn && logoutBtn) {
    userEmailBadge.classList.add('hidden');
    authBtn.classList.remove('hidden');
    logoutBtn.classList.add('hidden');
    if (mainContainer) mainContainer.classList.add('hidden');
    if (authModal) authModal.classList.remove('hidden');
  }
}

// --- DATA FETCHING & RENDERING ---
async function fetchAllData() {
  await Promise.all([fetchDomains(), fetchLinks(), fetchApiKeys()]);
  populateDnsGuide();
}

// Populate DNS guide placeholders with dynamic SYSTEM_DOMAIN from server config
function populateDnsGuide() {
  const sd = state.serverConfig.system_domain || window.location.hostname || 'localhost';
  document.querySelectorAll('.dns-system-domain').forEach(el => {
    el.textContent = sd;
  });
}

async function fetchDomains() {
  try {
    state.domains = await apiGet('/domains');
    renderDomains();
    populateDomainSelect();
  } catch (err) {
    console.error('Error fetching domains:', err);
  }
}

async function fetchLinks() {
  try {
    state.links = await apiGet('/links');
    renderLinks();
    populateAnalyticsSelect();
    loadAnalyticsForSelectedLink();
  } catch (err) {
    console.error('Error fetching links:', err);
  }
}

async function fetchApiKeys() {
  try {
    state.apiKeys = await apiGet('/api-keys');
    renderApiKeys();
  } catch (err) {
    console.error('Error fetching API keys:', err);
  }
}

function populateDomainSelect() {
  if (!domainSelect) return;
  domainSelect.innerHTML = '';

  // Always include default system domain for zero-config instant link shortening
  const defaultOpt = document.createElement('option');
  defaultOpt.value = 'default_system';
  defaultOpt.textContent = `Sistem Domaini (${state.serverConfig.system_domain})`;
  domainSelect.appendChild(defaultOpt);

  state.domains.forEach(d => {
    const opt = document.createElement('option');
    opt.value = d.id;
    opt.textContent = `${d.hostname} (${d.verification_status})`;
    domainSelect.appendChild(opt);
  });
}

function populateAnalyticsSelect() {
  if (!analyticsLinkSelect) return;
  analyticsLinkSelect.innerHTML = '';
  state.links.forEach(l => {
    const opt = document.createElement('option');
    opt.value = l.id;
    opt.textContent = `/${l.slug} -> ${l.destination_url}`;
    analyticsLinkSelect.appendChild(opt);
  });
}

function renderDomains() {
  if (statTotalDomains) statTotalDomains.textContent = state.domains.length;
  if (!domainsList) return;

  domainsList.innerHTML = '';

  if (state.domains.length === 0) {
    domainsList.innerHTML = '<div class="text-slate-500 text-center py-6">Henüz özel domain eklenmedi. Yukarıdaki formdan ekleyebilirsiniz!</div>';
    return;
  }

  state.domains.forEach(d => {
    const isVerified = d.verification_status === 'active' || d.verification_status === 'verified';
    const statusBadge = isVerified
      ? '<span class="badge-active">AKTİF</span>'
      : '<span class="badge-pending">DNS BEKLENİYOR</span>';

    const systemTarget = (window.location.hostname && window.location.hostname !== 'localhost' && window.location.hostname !== '127.0.0.1')
      ? window.location.hostname
      : state.serverConfig.system_domain;

    const card = document.createElement('div');
    card.className = 'card p-5';
    card.innerHTML = `
      <div class="flex items-center justify-between mb-3">
        <div class="flex items-center gap-3">
          <span class="font-bold text-lg text-white">${d.hostname}</span>
          ${statusBadge}
        </div>
        <div class="flex items-center gap-2">
          ${!isVerified ? `<button type="button" class="btn-secondary text-xs py-1 px-3" onclick="verifyDomain('${d.id}')">DNS Doğrula</button>` : ''}
          <button type="button" class="btn-secondary text-xs text-rose-400 py-1 px-2 hover:bg-rose-950/40" onclick="deleteDomain('${d.id}')">Sil</button>
        </div>
      </div>

      <div class="bg-slate-950 p-4 rounded-xl border border-slate-800/80 mt-2 font-mono text-xs">
        <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div>
            <span class="text-indigo-400 font-bold">CNAME Kaydı:</span> 
            <span class="text-slate-300">Host:</span> <code>${d.hostname}</code>
            <span class="text-slate-300 ml-2">Hedef:</span> <code>${systemTarget}</code>
          </div>
          <button type="button" class="btn-secondary text-xs py-1 px-3 whitespace-nowrap" onclick="copyText('${systemTarget}')">Hedefi Kopyala</button>
        </div>
      </div>
    `;
    domainsList.appendChild(card);
  });
}

function renderLinks() {
  if (statTotalLinks) statTotalLinks.textContent = state.links.length;
  if (!linksList) return;

  linksList.innerHTML = '';

  if (state.links.length === 0) {
    linksList.innerHTML = '<div class="text-slate-500 text-center py-6">Henüz kısa link oluşturulmadı. Yukarıdaki formu kullanabilirsiniz!</div>';
    return;
  }

  state.links.forEach(l => {
    const domain = state.domains.find(d => d.id === l.domain_id);
    const hostname = domain ? domain.hostname : state.serverConfig.system_domain;
    const shortUrl = `http://${hostname}/${l.slug}`;

    const card = document.createElement('div');
    card.className = 'card p-5 flex flex-col md:flex-row md:items-center justify-between gap-4';
    card.innerHTML = `
      <div class="space-y-1 max-w-2xl">
        <div class="flex items-center gap-3">
          <a href="${shortUrl}" target="_blank" class="font-bold text-base text-indigo-400 hover:underline flex items-center gap-1.5">
            ${shortUrl}
            <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"/></svg>
          </a>
          <span class="text-xs font-mono bg-slate-800 text-slate-300 px-2 py-0.5 rounded">${l.redirect_type || 302}</span>
        </div>
        <div class="text-xs text-slate-400 truncate max-w-xl">
          <span class="text-slate-500">Hedef:</span> ${l.destination_url}
        </div>
      </div>

      <div class="flex items-center gap-2">
        <button type="button" class="btn-secondary text-xs py-1.5 px-3" onclick="copyText('${shortUrl}')">
          Linki Kopyala
        </button>
        <button type="button" class="btn-secondary text-xs py-1.5 px-3 text-indigo-300 hover:text-white" onclick="viewQrCode('${l.id}')">
          QR Kod
        </button>
        <button type="button" class="btn-secondary text-xs text-rose-400 py-1.5 px-2 hover:bg-rose-950/40" onclick="deleteLink('${l.id}')">
          Sil
        </button>
      </div>
    `;
    linksList.appendChild(card);
  });
}

function renderApiKeys() {
  if (statTotalApiKeys) statTotalApiKeys.textContent = state.apiKeys.length;
  if (!apiKeysList) return;

  apiKeysList.innerHTML = '';

  if (state.apiKeys.length === 0) {
    apiKeysList.innerHTML = '<div class="text-slate-500 text-center py-6">No API keys created yet.</div>';
    return;
  }

  state.apiKeys.forEach(k => {
    const card = document.createElement('div');
    card.className = 'card p-4 flex items-center justify-between';
    card.innerHTML = `
      <div>
        <div class="font-bold text-sm text-white">${k.name}</div>
        <div class="text-xs text-slate-500 font-mono">Created: ${new Date(k.created_at).toLocaleDateString()}</div>
      </div>
      <button type="button" class="btn-secondary text-xs text-rose-400 py-1 px-2" onclick="deleteApiKey('${k.id}')">Revoke Key</button>
    `;
    apiKeysList.appendChild(card);
  });
}

async function loadAnalyticsForSelectedLink() {
  if (!analyticsLinkSelect) return;
  const linkId = analyticsLinkSelect.value;
  if (!linkId) return;

  try {
    const data = await apiGet(`/links/${linkId}/analytics`);
    if (statTotalClicks) statTotalClicks.textContent = data.total_clicks || 0;

    renderAnalyticsList(deviceStatsList, data.devices, 'device', data.total_clicks);
    renderAnalyticsList(browserStatsList, data.browsers, 'browser', data.total_clicks);
    renderAnalyticsList(referrerStatsList, data.referrers, 'referrer', data.total_clicks);
  } catch (err) {
    console.error('Error loading analytics:', err);
  }
}

function renderAnalyticsList(container, items, keyName, totalClicks) {
  if (!container) return;
  container.innerHTML = '';
  if (!items || items.length === 0) {
    container.innerHTML = '<div class="text-slate-500 text-xs py-2">No click data logged yet.</div>';
    return;
  }

  items.forEach(item => {
    const label = item[keyName] || 'Unknown';
    const count = item.count || 0;
    const percent = totalClicks > 0 ? Math.round((count / totalClicks) * 100) : 0;

    const row = document.createElement('div');
    row.className = 'space-y-1';
    row.innerHTML = `
      <div class="flex justify-between text-xs font-medium">
        <span class="text-slate-300">${label}</span>
        <span class="text-indigo-400 font-mono">${count} (${percent}%)</span>
      </div>
      <div class="w-full bg-slate-800 h-1.5 rounded-full overflow-hidden">
        <div class="bg-gradient-to-r from-indigo-500 to-violet-500 h-full rounded-full" style="width: ${percent}%"></div>
      </div>
    `;
    container.appendChild(row);
  });
}

// Global actions attached to window for HTML onclick handlers
window.viewQrCode = async (id) => {
  try {
    const data = await apiGet(`/links/${id}/qrcode`);
    if (qrUrlDisplay) qrUrlDisplay.textContent = data.short_url;
    if (qrImageDisplay) qrImageDisplay.src = data.qr_code;
    if (downloadQrBtn) downloadQrBtn.href = data.qr_code;
    window.openQrModal();
  } catch (err) {
    showToast(`QR Code Error: ${err.message}`, true);
  }
};

window.verifyDomain = async (id) => {
  try {
    const res = await apiPost(`/domains/${id}/verify`, {});
    if (res.verified) {
      showToast('DNS verified successfully! Domain is active.');
    } else {
      showToast(`DNS Verification Pending: ${res.verification_message}`, true);
    }
    await fetchDomains();
  } catch (err) {
    showToast(`Verification error: ${err.message}`, true);
  }
};

window.deleteDomain = async (id) => {
  if (!confirm('Are you sure you want to delete this domain?')) return;
  try {
    await apiDelete(`/domains/${id}`);
    await fetchDomains();
    showToast('Domain deleted');
  } catch (err) {
    showToast(err.message, true);
  }
};

window.deleteLink = async (id) => {
  if (!confirm('Are you sure you want to delete this link?')) return;
  try {
    await apiDelete(`/links/${id}`);
    await fetchLinks();
    showToast('Link deleted');
  } catch (err) {
    showToast(err.message, true);
  }
};

window.deleteApiKey = async (id) => {
  if (!confirm('Are you sure you want to revoke this API key?')) return;
  try {
    await apiDelete(`/api-keys/${id}`);
    await fetchApiKeys();
    showToast('API key revoked');
  } catch (err) {
    showToast(err.message, true);
  }
};
