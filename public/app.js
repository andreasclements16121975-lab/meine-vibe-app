let token = localStorage.getItem('token') || '';
let editingMemberId = null;
let currentUser = null;
let calendarViewDate = new Date();
let calendarEvents = [];
let selectedCalendarEventId = '';
const LINEUP_STORAGE_KEY = 'lineupBuilderStoreV1';
const lineupState = {
  sourceMode: 'free',
  eventId: '',
  formationId: '442',
  scenarioName: 'Freies Szenario',
  players: [],
  assigned: {},
  selectedPlayerId: null,
  selectedSlotId: null
};

let lineupBuilderInitialized = false;
let lineupMembersCache = [];
function createFormation(id, name, rows) {
  const positions = [{ slotId: `${id}-gk`, label: 'TW', x: 50, y: 90 }];

  rows.forEach((row, rowIndex) => {
    row.labels.forEach((label, index) => {
      const x = row.labels.length === 1 ? 50 : 14 + (72 / (row.labels.length - 1)) * index;
      positions.push({
        slotId: `${id}-${rowIndex}-${index}`,
        label,
        x,
        y: row.y
      });
    });
  });

  return { id, name, positions };
}

const LINEUP_FORMATIONS = [
  createFormation('442', '4-4-2', [
    { y: 76, labels: ['LV', 'IV', 'IV', 'RV'] },
    { y: 56, labels: ['LM', 'ZM', 'ZM', 'RM'] },
    { y: 28, labels: ['ST', 'ST'] }
  ]),
  createFormation('4231', '4-2-3-1', [
    { y: 76, labels: ['LV', 'IV', 'IV', 'RV'] },
    { y: 60, labels: ['6', '6'] },
    { y: 42, labels: ['LA', '10', 'RA'] },
    { y: 24, labels: ['ST'] }
  ]),
  createFormation('433', '4-3-3', [
    { y: 76, labels: ['LV', 'IV', 'IV', 'RV'] },
    { y: 56, labels: ['8', '6', '8'] },
    { y: 28, labels: ['LA', 'ST', 'RA'] }
  ]),
  createFormation('4312', '4-3-2-1 / 4-3-1-2', [
    { y: 76, labels: ['LV', 'IV', 'IV', 'RV'] },
    { y: 58, labels: ['8', '6', '8'] },
    { y: 40, labels: ['10'] },
    { y: 24, labels: ['ST', 'ST'] }
  ]),
  createFormation('343', '3-4-3', [
    { y: 78, labels: ['IV', 'IV', 'IV'] },
    { y: 56, labels: ['LM', 'ZM', 'ZM', 'RM'] },
    { y: 28, labels: ['LA', 'ST', 'RA'] }
  ]),
  createFormation('532', '5-3-2', [
    { y: 80, labels: ['LAV', 'IV', 'IV', 'IV', 'RAV'] },
    { y: 56, labels: ['ZM', '6', 'ZM'] },
    { y: 28, labels: ['ST', 'ST'] }
  ]),
  createFormation('352', '3-5-2', [
    { y: 80, labels: ['IV', 'IV', 'IV'] },
    { y: 56, labels: ['LM', 'ZM', '6', 'ZM', 'RM'] },
    { y: 28, labels: ['ST', 'ST'] }
  ]),
  createFormation('3331', '3-3-3-1', [
    { y: 80, labels: ['IV', 'IV', 'IV'] },
    { y: 60, labels: ['LM', '6', 'RM'] },
    { y: 40, labels: ['LA', '10', 'RA'] },
    { y: 22, labels: ['ST'] }
  ]),
  createFormation('541', '5-4-1', [
    { y: 80, labels: ['LAV', 'IV', 'IV', 'IV', 'RAV'] },
    { y: 56, labels: ['LM', 'ZM', 'ZM', 'RM'] },
    { y: 24, labels: ['ST'] }
  ]),
  createFormation('451', '4-5-1', [
    { y: 78, labels: ['LV', 'IV', 'IV', 'RV'] },
    { y: 54, labels: ['LM', 'ZM', '6', 'ZM', 'RM'] },
    { y: 24, labels: ['ST'] }
  ]),
  createFormation('4141', '4-1-4-1', [
    { y: 78, labels: ['LV', 'IV', 'IV', 'RV'] },
    { y: 62, labels: ['6'] },
    { y: 42, labels: ['LM', 'ZM', 'ZM', 'RM'] },
    { y: 24, labels: ['ST'] }
  ]),
  createFormation('424', '4-2-4', [
    { y: 78, labels: ['LV', 'IV', 'IV', 'RV'] },
    { y: 56, labels: ['ZM', 'ZM'] },
    { y: 28, labels: ['LA', 'ST', 'ST', 'RA'] }
  ]),
  createFormation('334', '3-3-4 / 3-3-1-3', [
    { y: 80, labels: ['IV', 'IV', 'IV'] },
    { y: 58, labels: ['LM', '6', 'RM'] },
    { y: 30, labels: ['LA', 'ST', 'ST', 'RA'] }
  ])
];
const api = async (url, options = {}) => {
  const res = await fetch(url, {
    ...options,
    headers: {
      ...(options.headers || {}),
      ...(token ? { Authorization: `Bearer ${token}` } : {})
    }
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || 'Fehler');
  return data;
};

const el = (id) => document.getElementById(id);
let activeDashboardTab = 'overview';

const normalizeRole = (role) => String(role || '').trim().toLowerCase();
const isAdmin = () => normalizeRole(currentUser?.role) === 'admin';
function getLineupStore() {
  try {
    return JSON.parse(localStorage.getItem(LINEUP_STORAGE_KEY) || '{}');
  } catch {
    return {};
  }
}

function setLineupStore(store) {
  localStorage.setItem(LINEUP_STORAGE_KEY, JSON.stringify(store));
}

function buildFallbackLineupPlayers() {
  return Array.from({ length: 18 }, (_, index) => ({
    id: `fallback-player-${index + 1}`,
    name: `Spieler ${index + 1}`,
    team: 'Testkader',
    role: 'Spieler'
  }));
}

function getCurrentLineupFormation() {
  return LINEUP_FORMATIONS.find((formation) => formation.id === lineupState.formationId) || LINEUP_FORMATIONS[0];
}

function getLineupStorageContextKey() {
  if (lineupState.sourceMode === 'event' && lineupState.eventId) {
    return `event:${lineupState.eventId}`;
  }
  return 'free:default';
}

function sanitizeLineupAssignments() {
  const slotIds = new Set(getCurrentLineupFormation().positions.map((position) => position.slotId));
  const playerIds = new Set(lineupState.players.map((player) => player.id));

  lineupState.assigned = Object.fromEntries(
    Object.entries(lineupState.assigned).filter(([slotId, playerId]) => slotIds.has(slotId) && playerIds.has(playerId))
  );

  if (lineupState.selectedSlotId && !slotIds.has(lineupState.selectedSlotId)) {
    lineupState.selectedSlotId = null;
  }
}

function formatLineupEventLabel(eventItem) {
  const title = eventItem.title || 'Termin';
  const opponent = eventItem.opponent ? ` ${eventItem.opponent}` : '';
  const date = eventItem.date || '';
  return [date, `${title}${opponent}`].filter(Boolean).join(' – ');
}

function refreshLineupEventOptions() {
  const select = el('lineupEventSelect');
  if (!select) return;

  const previous = lineupState.eventId || select.value || '';
  select.innerHTML = `<option value="">Event wählen</option>${calendarEvents
    .map((eventItem) => `<option value="${eventItem.id}">${formatLineupEventLabel(eventItem)}</option>`)
    .join('')}`;

  if (previous && calendarEvents.some((eventItem) => eventItem.id === previous)) {
    select.value = previous;
    lineupState.eventId = previous;
  }
}
async function fetchLineupMembers() {
  try {
    const members = await api('/api/members');
    lineupMembersCache = members
      .filter((member) => member.role === 'Spieler')
      .map((member) => ({
        id: member.id,
        name: member.name,
        team: member.team || '',
        role: member.role
      }));

    if (!lineupMembersCache.length) {
      lineupMembersCache = buildFallbackLineupPlayers();
    }

    return lineupMembersCache;
  } catch {
    if (!lineupMembersCache.length) {
      lineupMembersCache = buildFallbackLineupPlayers();
    }
    return lineupMembersCache;
  }
}

async function fetchLineupPlayersForEvent(eventId) {
  const members = await fetchLineupMembers();

  try {
    const nominations = await api(`/api/nominations/${eventId}`);
    if (!Array.isArray(nominations) || !nominations.length) {
      return members;
    }

    const mapped = nominations.map((entry, index) => {
      const fromMembers = members.find((member) => member.id === entry.playerId);
      if (fromMembers) return fromMembers;

      return {
        id: entry.playerId || entry.id || `nom-player-${index + 1}`,
        name: entry.playerName || `Spieler ${index + 1}`,
        team: '',
        role: 'Spieler'
      };
    });

    return Array.from(new Map(mapped.map((player) => [player.id, player])).values());
  } catch {
    return members;
  }
}

function getLineupPlayerById(playerId) {
  return lineupState.players.find((player) => player.id === playerId) || null;
}

function getSelectedLineupPlayer() {
  if (!lineupState.selectedSlotId) return null;
  return getLineupPlayerById(lineupState.assigned[lineupState.selectedSlotId]);
}

function setLineupStatus(text) {
  const node = el('lineupStatusText');
  if (node) node.textContent = text;
}

function loadStoredLineupForContext() {
  const entry = getLineupStore()[getLineupStorageContextKey()];
  if (!entry) {
    lineupState.assigned = {};
    lineupState.selectedSlotId = null;
    return;
  }

  lineupState.formationId = entry.formationId || lineupState.formationId;
  lineupState.assigned = entry.assigned || {};
  lineupState.selectedSlotId = null;
  lineupState.scenarioName = entry.name || lineupState.scenarioName;

  if (el('lineupFormationSelect')) {
    el('lineupFormationSelect').value = lineupState.formationId;
  }

  if (el('lineupScenarioName')) {
    el('lineupScenarioName').value = lineupState.scenarioName;
  }

  if (el('lineupSaveState')) {
    const updatedAt = entry.updatedAt ? new Date(entry.updatedAt).toLocaleString('de-DE') : 'unbekannt';
    el('lineupSaveState').textContent = `${entry.name || 'Aufstellung'} – ${updatedAt}`;
  }
}

function renderLineupFormationOptions() {
  const select = el('lineupFormationSelect');
  if (!select) return;

  select.innerHTML = LINEUP_FORMATIONS.map(
    (formation) => `<option value="${formation.id}">${formation.name}</option>`
  ).join('');

  select.value = lineupState.formationId;
}

function renderLineupSelectedInfo() {
  const formation = getCurrentLineupFormation();
  const selectedPosition = formation.positions.find((position) => position.slotId === lineupState.selectedSlotId) || null;
  const selectedPlayer = getSelectedLineupPlayer();

  const slotLabel = el('lineupSelectedSlotLabel');
  if (slotLabel) slotLabel.textContent = selectedPosition ? selectedPosition.label : 'Keine Position gewählt';

  const playerLabel = el('lineupSelectedPlayerLabel');
  if (playerLabel) playerLabel.textContent = selectedPlayer ? selectedPlayer.name : 'Niemand zugewiesen';

  const assignedCount = Object.keys(lineupState.assigned).length;

  const countLabel = el('lineupAssignedCount');
  if (countLabel) countLabel.textContent = `${assignedCount}/${formation.positions.length} besetzt`;

  const playerCountLabel = el('lineupPlayerCount');
  if (playerCountLabel) playerCountLabel.textContent = `${lineupState.players.length} Spieler`;
}
function renderLineupPitch() {
  const host = el('lineupPitchSlots');
  if (!host) return;

  const formation = getCurrentLineupFormation();

  host.innerHTML = formation.positions
    .map((position) => {
      const assignedPlayer = getLineupPlayerById(lineupState.assigned[position.slotId]);
      const isSelected = lineupState.selectedSlotId === position.slotId;

      return `
        <button
          type="button"
          data-lineup-slot="${position.slotId}"
          class="absolute z-20 cursor-pointer pointer-events-auto -translate-x-1/2 -translate-y-1/2 w-[74px] h-[52px] sm:w-[88px] sm:h-[58px] rounded-xl border px-1 py-1 text-center shadow-md ${
            assignedPlayer ? 'bg-white text-slate-900 border-white/90' : 'bg-white/15 text-white border-white/35'
          } ${isSelected ? 'ring-4 ring-amber-300' : 'ring-2 ring-white/10'}"
          style="left:${position.x}%; top:${position.y}%"
        >
          <div class="text-[10px] font-bold uppercase ${assignedPlayer ? 'text-emerald-700' : 'text-white/90'}">${position.label}</div>
          <div class="text-[11px] sm:text-xs font-medium leading-tight truncate">${assignedPlayer ? assignedPlayer.name : 'frei'}</div>
        </button>
      `;
    })
    .join('');

  Array.from(host.querySelectorAll('[data-lineup-slot]')).forEach((button) => {
    button.addEventListener('click', (event) => {
      event.preventDefault();
      event.stopPropagation();

      const slotId = button.dataset.lineupSlot || '';

      if (!lineupState.selectedPlayerId) {
        setLineupStatus('Bitte zuerst einen Spieler auswählen.');
        return;
      }

      Object.keys(lineupState.assigned).forEach((sid) => {
        if (lineupState.assigned[sid] === lineupState.selectedPlayerId) {
          delete lineupState.assigned[sid];
        }
      });

      lineupState.assigned[slotId] = lineupState.selectedPlayerId;
      lineupState.selectedPlayerId = null;
      renderLineupBuilder();
      setLineupStatus('Spieler wurde zugewiesen.');
    });
  });
}

function renderLineupPlayerPool() {
  const host = el('lineupPlayerPool');
  if (!host) return;

  const assignedIds = new Set(Object.values(lineupState.assigned));
  const availablePlayers = lineupState.players.filter((player) => !assignedIds.has(player.id));

  host.innerHTML = availablePlayers.length
    ? availablePlayers
        .map(
          (player) => `
            <button
              type="button"
              data-lineup-player="${player.id}"
              class="w-full text-left border rounded-xl bg-white px-3 py-2 hover:bg-slate-100"
            >
              <div class="font-medium text-slate-800">${player.name}</div>
              <div class="text-xs text-slate-500">${player.team || 'Spieler'}</div>
            </button>
          `
        )
        .join('')
    : `<div class="text-sm text-slate-500 border rounded-xl bg-white px-3 py-3">Keine freien Spieler mehr.</div>`;

  Array.from(host.querySelectorAll('[data-lineup-player]')).forEach((button) => {
  button.addEventListener('click', () => {
    const playerId = button.dataset.lineupPlayer || '';
    lineupState.selectedPlayerId = playerId;
    renderLineupBuilder();
    setLineupStatus('Spieler gewählt. Jetzt eine Position auf dem Spielfeld auswählen.');
  });
});
}

function renderLineupBuilder() {
  sanitizeLineupAssignments();
  renderLineupPitch();
  renderLineupPlayerPool();
  renderLineupSelectedInfo();
}

async function refreshLineupBuilderData() {
  lineupState.sourceMode = el('lineupSourceMode')?.value || 'free';
  lineupState.eventId = el('lineupEventSelect')?.value || '';
  lineupState.formationId = el('lineupFormationSelect')?.value || lineupState.formationId;
  lineupState.scenarioName = el('lineupScenarioName')?.value.trim() || 'Freies Szenario';

  el('lineupEventWrap')?.classList.toggle('hidden', lineupState.sourceMode !== 'event');

  loadStoredLineupForContext();

  lineupState.players =
    lineupState.sourceMode === 'event' && lineupState.eventId
      ? await fetchLineupPlayersForEvent(lineupState.eventId)
      : await fetchLineupMembers();

  sanitizeLineupAssignments();
  renderLineupBuilder();
}

function saveCurrentLineup() {
  if (lineupState.sourceMode === 'event' && !lineupState.eventId) {
    setLineupStatus('Bitte zuerst ein Event auswählen.');
    return;
  }

  const store = getLineupStore();
  const payload = {
    name: el('lineupScenarioName')?.value.trim() || 'Freies Szenario',
    formationId: el('lineupFormationSelect')?.value || lineupState.formationId,
    assigned: lineupState.assigned,
    updatedAt: new Date().toISOString()
  };

  store[getLineupStorageContextKey()] = payload;
  setLineupStore(store);

  el('lineupSaveState').textContent = `${payload.name} – ${new Date(payload.updatedAt).toLocaleString('de-DE')}`;
  setLineupStatus('Aufstellung gespeichert.');
}

function resetCurrentLineup() {
  lineupState.assigned = {};
  lineupState.selectedSlotId = null;
  renderLineupBuilder();
  setLineupStatus('Aufstellung zurückgesetzt.');
}

function clearSelectedLineupSlot() {
  if (!lineupState.selectedSlotId) {
    setLineupStatus('Bitte zuerst eine Position auswählen.');
    return;
  }

  delete lineupState.assigned[lineupState.selectedSlotId];
  renderLineupBuilder();
  setLineupStatus('Zuweisung entfernt.');
}

function initLineupBuilder() {
  if (lineupBuilderInitialized) return;
  if (!el('lineupFormationSelect')) return;

  lineupBuilderInitialized = true;

  renderLineupFormationOptions();
  refreshLineupEventOptions();
  el('lineupScenarioName').value = lineupState.scenarioName;

  el('lineupSourceMode').addEventListener('change', refreshLineupBuilderData);
  el('lineupEventSelect').addEventListener('change', refreshLineupBuilderData);
  el('lineupFormationSelect').addEventListener('change', refreshLineupBuilderData);
  el('lineupScenarioName').addEventListener('input', () => {
    lineupState.scenarioName = el('lineupScenarioName').value.trim() || 'Freies Szenario';
  });
  el('lineupClearSlotBtn').addEventListener('click', clearSelectedLineupSlot);
  el('lineupResetBtn').addEventListener('click', resetCurrentLineup);
  el('lineupSaveBtn').addEventListener('click', saveCurrentLineup);

  refreshLineupBuilderData();
}
function getStoredUser() {
  try {
    return JSON.parse(localStorage.getItem('currentUser') || 'null');
  } catch {
    return null;
  }
}

function setStoredUser(user) {
  currentUser = user || null;
  if (currentUser) {
    localStorage.setItem('currentUser', JSON.stringify(currentUser));
  } else {
    localStorage.removeItem('currentUser');
  }
}

function setTabButtonState(button, isActive) {
  button.className = `whitespace-nowrap rounded-lg px-4 py-2 text-sm font-medium transition ${isActive ? 'bg-emerald-600 text-white' : 'bg-slate-100 text-slate-700 hover:bg-slate-200'}`;
}

function activateDashboardTab(tabKey) {
  const buttons = Array.from(document.querySelectorAll('[data-tab-button]'));
  const panels = Array.from(document.querySelectorAll('[data-tab-panel]'));
  const allowedButtons = buttons.filter((button) => !button.dataset.adminOnly || isAdmin());
  const allowedKeys = allowedButtons.map((button) => button.dataset.tabButton);

  if (!allowedKeys.includes(tabKey)) {
    tabKey = allowedKeys[0] || 'overview';
  }

  activeDashboardTab = tabKey;

  buttons.forEach((button) => {
    const allowed = !button.dataset.adminOnly || isAdmin();
    button.classList.toggle('hidden', !allowed);
    if (!allowed) return;
    setTabButtonState(button, button.dataset.tabButton === tabKey);
  });

  panels.forEach((panel) => {
    const adminOnly = panel.dataset.adminOnly === 'true';
    const visible = panel.dataset.tabPanel === tabKey && (!adminOnly || isAdmin());
    panel.classList.toggle('hidden', !visible);
  });

  if (tabKey === 'coaching') {
    requestAnimationFrame(() => window.dispatchEvent(new Event('resize')));
  }
}

function renderSessionUi() {
  const hasUser = Boolean(currentUser);
  const welcomeBanner = el('welcomeBanner');
  const dashboardShell = el('dashboardShell');
  const welcomeUserName = el('welcomeUserName');

  if (welcomeBanner) {
    welcomeBanner.classList.toggle('hidden', !hasUser);
  }

  if (dashboardShell) {
    dashboardShell.classList.toggle('hidden', !hasUser);
  }

  if (!hasUser) {
    setAuthInfo('');
    return;
  }

  if (welcomeUserName) {
    welcomeUserName.textContent = currentUser.name || '';
  }

  setAuthInfo(`Eingeloggt als ${currentUser.name} (${currentUser.role})`);
  el('dashboardHome')?.classList.remove('hidden');
el('dashboardTabs')?.parentElement?.classList.add('hidden');
document.querySelectorAll('[data-tab-panel]').forEach((panel) => panel.classList.add('hidden'));
}

function initDashboardTabs() {
  const showDashboardHome = () => {
    el('dashboardHome')?.classList.remove('hidden');
    el('dashboardMiniNav')?.classList.add('hidden');
    document.querySelectorAll('[data-tab-panel]').forEach((panel) => panel.classList.add('hidden'));
  };

  const openDashboardSection = (tabKey) => {
    el('dashboardHome')?.classList.add('hidden');
    el('dashboardMiniNav')?.classList.remove('hidden');
    activateDashboardTab(tabKey);
  };

  el('dashboardTabs')?.addEventListener('click', (event) => {
    const button = event.target.closest('[data-tab-button]');
    if (!button) return;
    if (button.dataset.adminOnly && !isAdmin()) return;
    openDashboardSection(button.dataset.tabButton);
  });

  el('dashboardHome')?.addEventListener('click', (event) => {
    const button = event.target.closest('[data-home-target]');
    if (!button) return;
    openDashboardSection(button.dataset.homeTarget);
  });

  el('dashboardMiniNav')?.addEventListener('click', (event) => {
    const button = event.target.closest('[data-mini-target]');
    if (!button) return;
    openDashboardSection(button.dataset.miniTarget);
  });

  el('backToDashboardBtn')?.addEventListener('click', () => {
    showDashboardHome();
  });
}
function setAuthInfo(text) {
  el('authInfo').textContent = text;
}

async function login() {
  const email = el('loginEmail').value.trim().toLowerCase();
  const password = el('loginPassword').value;

  if (email === 'clements@vereinsadmin.de' && password === 'user123') {
    token = 'test-token';
    const testUser = {
      id: 'test-admin-1',
      name: 'Clemens',
      email: 'clements@vereinsadmin.de',
      role: 'Admin'
    };

    localStorage.setItem('token', token);
    setStoredUser(testUser);
    renderSessionUi();
    await bootstrapData();
    el('authMessage').textContent = 'Login erfolgreich';
    return;
  }

  try {
    const data = await api('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: el('loginEmail').value, password: el('loginPassword').value })
    });

    token = data.token;
    localStorage.setItem('token', token);
    setStoredUser(data.user);
    renderSessionUi();

    await bootstrapData();
    el('authMessage').textContent = 'Login erfolgreich';
  } catch (e) {
    el('authMessage').textContent = e.message;
  }
}

async function forgotPassword() {
  const data = await api('/api/auth/forgot-password', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: el('loginEmail').value })
  });
  el('authMessage').innerHTML = `${data.message} <a class="text-blue-700 underline" href="${data.resetUrl || '#'}">Reset öffnen</a>`;
}
const DEMO_MEMBERS = [
  { id: 'demo-1', name: 'Spieler 1', email: '', role: 'Spieler', team: 'Team A' },
  { id: 'demo-2', name: 'Spieler 2', email: '', role: 'Spieler', team: 'Team A' },
  { id: 'demo-3', name: 'Spieler 3', email: '', role: 'Spieler', team: 'Team A' },
  { id: 'demo-4', name: 'Spieler 4', email: '', role: 'Spieler', team: 'Team A' },
  { id: 'demo-5', name: 'Spieler 5', email: '', role: 'Spieler', team: 'Team A' },
  { id: 'demo-6', name: 'Spieler 6', email: '', role: 'Spieler', team: 'Team A' },
  { id: 'demo-7', name: 'Spieler 7', email: '', role: 'Spieler', team: 'Team A' },
  { id: 'demo-8', name: 'Spieler 8', email: '', role: 'Spieler', team: 'Team A' },
  { id: 'demo-9', name: 'Spieler 9', email: '', role: 'Spieler', team: 'Team A' },
  { id: 'demo-10', name: 'Spieler 10', email: '', role: 'Spieler', team: 'Team A' },
  { id: 'demo-11', name: 'Spieler 11', email: '', role: 'Spieler', team: 'Team A' },
  { id: 'demo-12', name: 'Spieler 12', email: '', role: 'Spieler', team: 'Team A' },
  { id: 'demo-13', name: 'Spieler 13', email: '', role: 'Spieler', team: 'Team A' },
  { id: 'demo-14', name: 'Spieler 14', email: '', role: 'Spieler', team: 'Team A' },
  { id: 'demo-15', name: 'Spieler 15', email: '', role: 'Spieler', team: 'Team A' },
];
async function loadMembers() {
  if (!isAdmin()) {
    el('membersList').innerHTML = '';
    return;
  }

  const members = await api('/api/members').catch(() => DEMO_MEMBERS);

  el('nomPlayerId').innerHTML =
  '<option value="">Spieler wählen</option>' +
  members
    .filter((m) => m.role === 'Spieler')
    .map((m) => `<option value="${m.id}">${m.name} (${m.team || '-'})</option>`)
    .join('');
el('nomPlayerButtons').innerHTML = members
  .filter((m) => m.role === 'Spieler')
  .map(
    (m) => `
      <button
        type="button"
        class="rounded border px-3 py-2 text-sm"
        data-player-id="${m.id}"
      >
        ${m.name}
      </button>
    `
  )
  .join('');
  el('nomPlayerButtons')?.querySelectorAll('[data-player-id]').forEach((button) => {
  button.addEventListener('click', () => {
    el('nomPlayerId').value = button.dataset.playerId || '';
  });
});
  el('membersList').innerHTML = members
    .map(
      (m) => `<div class="border rounded p-2 flex justify-between items-center gap-2">
      <span>${m.name} • ${m.role} • ${m.team || '-'} • ${m.email}</span>
      <div class="flex gap-1">
        <button class="px-2 py-1 text-xs bg-amber-400 rounded" onclick="editMember('${m.id}')">Bearbeiten</button>
        <button class="px-2 py-1 text-xs bg-rose-500 text-white rounded" onclick="deleteMember('${m.id}')">Löschen</button>
      </div>
      </div>`
    )
    .join('');
}

window.editMember = async (id) => {
  if (!isAdmin()) return;

  const members = await api('/api/members');
  const m = members.find((x) => x.id === id);
  if (!m) return;

  editingMemberId = id;
  el('memberName').value = m.name;
  el('memberEmail').value = m.email;
  el('memberRole').value = m.role;
  el('memberTeam').value = m.team || '';
};

window.deleteMember = async (id) => {
  if (!isAdmin()) return;
  await api(`/api/members/${id}`, { method: 'DELETE' });
  await loadMembers();
};

async function saveMember() {
  if (!isAdmin()) return;

  const payload = {
    name: el('memberName').value,
    email: el('memberEmail').value,
    role: el('memberRole').value,
    team: el('memberTeam').value
  };

  if (editingMemberId) {
    await api(`/api/members/${editingMemberId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    editingMemberId = null;
  } else {
    await api('/api/members', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
  }

  await loadMembers();
}

async function uploadLogo() {
  const file = el('logoInput').files[0];
  if (!file) return;
  const fd = new FormData();
  fd.append('logo', file);
  await api('/api/branding/logo', { method: 'POST', body: fd });
  await loadBranding();
}

async function loadBranding() {
  const b = await api('/api/branding');
  if (b.logoPath) {
    el('clubLogo').src = b.logoPath;
    el('clubLogo').classList.remove('hidden');
  }
}

const GOOGLE_MAPS_API_KEY = 'AIzaSyDTGv_RgaBypgLobEsebD182Iqt2SCh4d0';

function formatPlaceAddress(place) {
  const comps = place?.address_components || [];
  const pick = (...types) => comps.find((c) => types.every((t) => c.types.includes(t)))?.long_name || '';
  const street = pick('route');
  const number = pick('street_number');
  const zip = pick('postal_code');
  const city = pick('locality') || pick('postal_town') || pick('administrative_area_level_3');
  const line1 = [street, number].filter(Boolean).join(' ').trim();
  const line2 = [zip, city].filter(Boolean).join(' ').trim();
  const full = [line1, line2].filter(Boolean).join(', ').trim();
  return full || place?.formatted_address || '';
}

function loadGoogleMapsOnce() {
  if (window.google?.maps?.places) return Promise.resolve();
  if (window.__gmapsPromise) return window.__gmapsPromise;

  window.__gmapsPromise = new Promise((resolve, reject) => {
    window.__initGooglePlaces = () => resolve();
    const script = document.createElement('script');
    script.src = `https://maps.googleapis.com/maps/api/js?key=${GOOGLE_MAPS_API_KEY}&libraries=places&callback=__initGooglePlaces`;
    script.async = true;
    script.defer = true;
    script.onerror = () => reject(new Error('Google Maps konnte nicht geladen werden'));
    document.head.appendChild(script);
  });

  return window.__gmapsPromise;
}

async function initGooglePlacesForEventFields() {
  try {
    await loadGoogleMapsOnce();
    const geocoder = new google.maps.Geocoder();

    const opponentInput = el('eventOpponent');
    const addressInput = el('eventAddress');

    const resolveAddressGeo = async (address) =>
      new Promise((resolve) => {
        if (!address) return resolve(null);
        geocoder.geocode({ address }, (results, status) => {
          if (status === 'OK' && results?.[0]?.geometry?.location) {
            const loc = results[0].geometry.location;
            resolve({ lat: loc.lat(), lng: loc.lng() });
          } else {
            resolve(null);
          }
        });
      });

    const opponentAutocomplete = new google.maps.places.Autocomplete(opponentInput, {
      types: ['establishment'],
      fields: ['name', 'formatted_address', 'address_components']
    });

    const addressAutocomplete = new google.maps.places.Autocomplete(addressInput, {
      types: ['address'],
      fields: ['formatted_address', 'address_components', 'name']
    });

    let opponentSessionToken = new google.maps.places.AutocompleteSessionToken();
    let addressSessionToken = new google.maps.places.AutocompleteSessionToken();

    const refreshOpponentToken = () => {
      opponentSessionToken = new google.maps.places.AutocompleteSessionToken();
      opponentAutocomplete.setOptions({ sessionToken: opponentSessionToken });
    };

    const refreshAddressToken = () => {
      addressSessionToken = new google.maps.places.AutocompleteSessionToken();
      addressAutocomplete.setOptions({ sessionToken: addressSessionToken });
    };

    refreshOpponentToken();
    refreshAddressToken();

    opponentInput.addEventListener('focus', refreshOpponentToken);
    addressInput.addEventListener('focus', refreshAddressToken);

    opponentAutocomplete.addListener('place_changed', () => {
      const place = opponentAutocomplete.getPlace();
      const address = formatPlaceAddress(place);
      if (address) {
        addressInput.value = address;
      } else {
        addressInput.value = place?.name || '';
      }
      resolveAddressGeo(addressInput.value).then((geo) => {
        addressInput.dataset.lat = geo?.lat ?? '';
        addressInput.dataset.lng = geo?.lng ?? '';
      });
      refreshOpponentToken();
    });

    addressAutocomplete.addListener('place_changed', () => {
      const place = addressAutocomplete.getPlace();
      const address = formatPlaceAddress(place);
      addressInput.value = address || place?.name || '';
      resolveAddressGeo(addressInput.value).then((geo) => {
        addressInput.dataset.lat = geo?.lat ?? '';
        addressInput.dataset.lng = geo?.lng ?? '';
      });
      refreshAddressToken();
    });

    addressInput.addEventListener('blur', async () => {
      const geo = await resolveAddressGeo(addressInput.value);
      addressInput.dataset.lat = geo?.lat ?? '';
      addressInput.dataset.lng = geo?.lng ?? '';
    });
  } catch (err) {
    console.warn(err.message);
  }
}
function getEasterSunday(year) {
  const a = year % 19;
  const b = Math.floor(year / 100);
  const c = year % 100;
  const d = Math.floor(b / 4);
  const e = b % 4;
  const f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4);
  const k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const month = Math.floor((h + l - 7 * m + 114) / 31);
  const day = ((h + l - 7 * m + 114) % 31) + 1;
  return new Date(year, month - 1, day);
}

function formatDateKey(date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

function getHolidayMap(year) {
  const easterSunday = getEasterSunday(year);

  const addDays = (baseDate, days) => {
    const copy = new Date(baseDate);
    copy.setDate(copy.getDate() + days);
    return copy;
  };

  const holidays = [
    { date: new Date(year, 0, 1), name: 'Neujahr' },
    { date: addDays(easterSunday, -2), name: 'Karfreitag' },
    { date: addDays(easterSunday, 1), name: 'Ostermontag' },
    { date: new Date(year, 4, 1), name: 'Tag der Arbeit' },
    { date: addDays(easterSunday, 39), name: 'Christi Himmelfahrt' },
    { date: addDays(easterSunday, 50), name: 'Pfingstmontag' },
    { date: new Date(year, 9, 3), name: 'Tag der Deutschen Einheit' },
    { date: new Date(year, 11, 24), name: 'Heiligabend' },
    { date: new Date(year, 11, 25), name: '1. Weihnachtstag' },
    { date: new Date(year, 11, 26), name: '2. Weihnachtstag' },
    { date: new Date(year, 11, 31), name: 'Silvester' }
  ];

  return Object.fromEntries(holidays.map((holiday) => [formatDateKey(holiday.date), holiday.name]));
}
function renderCalendar(events) {
  calendarEvents = events;
  const now = new Date();
  const y = calendarViewDate.getFullYear();
  const m = calendarViewDate.getMonth();
  const holidayMap = getHolidayMap(y);
  const days = new Date(y, m + 1, 0).getDate();
  const startDay = (new Date(y, m, 1).getDay() + 6) % 7;
  const labels = ['Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa', 'So'];
  const cells = labels.map((d) => `<div class="font-semibold p-1 text-center">${d}</div>`);
  for (let i = 0; i < startDay; i++) cells.push('<div class="p-2 border rounded bg-slate-50"></div>');

  for (let day = 1; day <= days; day++) {
    const iso = `${y}-${String(m + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    const dayEvents = events.filter((e) => e.date === iso);
    const isToday = now.getFullYear() === y && now.getMonth() === m && now.getDate() === day;
   const holidayName = holidayMap[iso] || '';

cells.push(`
  <div class="p-2 border rounded min-h-20">
    <div class="font-medium inline-flex items-center justify-center w-7 h-7 rounded-full ${isToday ? 'bg-blue-100 text-blue-700' : ''}">
      ${day}
    </div>
    ${holidayName ? `<div class="text-[11px] rounded px-1 py-0.5 my-1 bg-rose-100 text-rose-700 leading-tight">${holidayName}</div>` : ''}
    ${dayEvents
      .map((e) => {
        const eventLabel = e.title || 'Termin';
        const detailLabel = e.opponent || '';
        const addressLabel = e.address || '-';

        const eventTypeClass =
          e.title === 'Training'
            ? 'bg-blue-100'
            : e.title === 'Event'
              ? 'bg-orange-100'
              : 'bg-emerald-100';

        return `
          <div class="text-xs rounded px-1 py-1 my-1 ${eventTypeClass} leading-tight cursor-pointer overflow-hidden" data-event-id="${e.id}" title="${eventLabel}${detailLabel ? ` - ${detailLabel}` : ''} | ${addressLabel}">
            <div class="font-medium truncate">${eventLabel}</div>
            <div class="truncate">${detailLabel || '-'}</div>
            <div class="truncate">${addressLabel}</div>
            <a class="text-blue-700 underline block truncate" href="${e.mapLink || '#'}" target="_blank" rel="noreferrer">Google Maps</a>
          </div>
        `;
      })
      .join('')}
  </div>
`);
  }
  el('calendarGrid').innerHTML = cells.join('');
  el('currentYearLabel').textContent = String(y);
  el('monthSelect').value = String(m);
  refreshLineupEventOptions();
}

function initCalendarControls() {
  const months = ['Januar', 'Februar', 'März', 'April', 'Mai', 'Juni', 'Juli', 'August', 'September', 'Oktober', 'November', 'Dezember'];
  el('monthSelect').innerHTML = months.map((name, idx) => `<option value="${idx}">${name}</option>`).join('');
  el('monthSelect').value = String(calendarViewDate.getMonth());
  el('currentYearLabel').textContent = String(calendarViewDate.getFullYear());

  el('prevMonthBtn').addEventListener('click', () => {
    calendarViewDate = new Date(calendarViewDate.getFullYear(), calendarViewDate.getMonth() - 1, 1);
    renderCalendar(calendarEvents);
  });
  el('nextMonthBtn').addEventListener('click', () => {
    calendarViewDate = new Date(calendarViewDate.getFullYear(), calendarViewDate.getMonth() + 1, 1);
    renderCalendar(calendarEvents);
  });
  el('monthSelect').addEventListener('change', () => {
    calendarViewDate = new Date(calendarViewDate.getFullYear(), Number(el('monthSelect').value), 1);
    renderCalendar(calendarEvents);
  });

  el('calendarGrid').addEventListener('click', (ev) => {
    const entry = ev.target.closest('[data-event-id]');
    if (!entry) return;
    openCalendarModal(entry.dataset.eventId);
  });
}

function openCalendarModal(eventId) {
  const eventItem = calendarEvents.find((e) => e.id === eventId);
  if (!eventItem) return;
  selectedCalendarEventId = eventId;
  el('calendarModalContent').innerHTML = `
    <div><b>Titel:</b> ${eventItem.title}${eventItem.opponent ? ` ${eventItem.opponent}` : ''}</div>
    <div><b>Datum:</b> ${eventItem.date}</div>
    <div><b>Ort:</b> ${eventItem.address || '-'}</div>
    <div><b>Untergrund:</b> ${eventItem.surface || '-'}</div>
    <div><b>Treffzeit:</b> ${eventItem.meetingTime || '-'}</div>
    <div><b>Anstoßzeit:</b> ${eventItem.kickoffTime || '-'}</div>
    <div><b>Zu-/Absage bis:</b> ${eventItem.responseDeadline ? new Date(eventItem.responseDeadline).toLocaleString('de-DE') : '-'}</div>
    <div><a class="text-blue-700 underline" href="${eventItem.mapLink || '#'}" target="_blank" rel="noreferrer">Google Maps öffnen</a></div>
  `;
  el('calendarModal').classList.remove('hidden');
  el('calendarModal').classList.add('flex');
}

function closeCalendarModal() {
  el('calendarModal').classList.add('hidden');
  el('calendarModal').classList.remove('flex');
}
function openDeleteEventsModal() {
  renderDeleteEventsList();
  el('deleteEventsModal').classList.remove('hidden');
  el('deleteEventsModal').classList.add('flex');
}

function closeDeleteEventsModal() {
  el('deleteEventsModal').classList.add('hidden');
  el('deleteEventsModal').classList.remove('flex');
}

function renderDeleteEventsList() {
  const events = JSON.parse(localStorage.getItem('localEvents') || '[]');

  if (!events.length) {
    el('deleteEventsList').innerHTML = '<div class="text-sm text-slate-500">Keine Termine vorhanden.</div>';
    return;
  }

  el('deleteEventsList').innerHTML = events
    .map((event) => {
      const label = [
        event.date || '-',
        event.title || 'Termin',
        event.opponent || '',
        event.address || ''
      ]
        .filter(Boolean)
        .join(' – ');

      return `
        <label class="flex items-start gap-3 border rounded p-2">
          <input type="checkbox" class="delete-event-checkbox mt-1" value="${event.id}" />
          <span class="text-sm">${label}</span>
        </label>
      `;
    })
    .join('');
}

async function deleteSelectedEvents() {
  const selectedIds = Array.from(document.querySelectorAll('.delete-event-checkbox:checked')).map((input) => input.value);

  if (!selectedIds.length) {
    alert('Bitte mindestens einen Termin auswählen.');
    return;
  }

  const events = JSON.parse(localStorage.getItem('localEvents') || '[]');
  const filteredEvents = events.filter((event) => !selectedIds.includes(event.id));

  localStorage.setItem('localEvents', JSON.stringify(filteredEvents));

  if (selectedCalendarEventId && selectedIds.includes(selectedCalendarEventId)) {
    selectedCalendarEventId = '';
    closeCalendarModal();
  }

  closeDeleteEventsModal();
  await loadEvents();
}
function updateTrainingSeriesVisibility() {
  const isTraining = el('eventTitle').value === 'Training';
  el('trainingSeriesBox').classList.toggle('hidden', !isTraining);
}

function getSeriesDates() {
  const start = el('seriesStartDate').value;
  const end = el('seriesEndDate').value;
  const weeks = Number(el('seriesWeeks').value || 0);
  const weekdays = Array.from(document.querySelectorAll('.seriesWeekday:checked')).map((x) => Number(x.value));

  if (!start || weekdays.length === 0 || (!end && !weeks)) return null;
  const startDate = new Date(start);
  const maxDate = end
    ? new Date(end)
    : new Date(startDate.getFullYear(), startDate.getMonth(), startDate.getDate() + weeks * 7 - 1);

  if (Number.isNaN(startDate.getTime()) || Number.isNaN(maxDate.getTime()) || maxDate < startDate) return null;

  const dates = [];
  const cursor = new Date(startDate);
  while (cursor <= maxDate) {
    if (weekdays.includes(cursor.getDay())) {
      dates.push(`${cursor.getFullYear()}-${String(cursor.getMonth() + 1).padStart(2, '0')}-${String(cursor.getDate()).padStart(2, '0')}`);
    }
    cursor.setDate(cursor.getDate() + 1);
  }
  return dates;
}

function clearEventFieldHighlights() {
  ['eventTitle', 'eventDate', 'eventAddress', 'eventMeetingTime', 'eventKickoffTime', 'eventDeadlineDate', 'eventDeadlineTime'].forEach((id) => {
    el(id).classList.remove('border-rose-500', 'ring-1', 'ring-rose-300');
  });
}

function highlightEventFields(ids) {
  ids.forEach((id) => el(id).classList.add('border-rose-500', 'ring-1', 'ring-rose-300'));
}

function saveEventLocally(eventData) {
  const events = JSON.parse(localStorage.getItem('localEvents') || '[]');

  const normalizedTitle = (eventData.title || '').trim();
  const normalizedOpponent = (eventData.opponent || '').trim();
  const normalizedAddress = (eventData.address || '').trim();
  const normalizedDate = (eventData.date || '').trim();

  const existingIndex = events.findIndex((event) => {
    return (
      (event.title || '').trim() === normalizedTitle &&
      (event.opponent || '').trim() === normalizedOpponent &&
      (event.address || '').trim() === normalizedAddress &&
      (event.date || '').trim() === normalizedDate
    );
  });

  const newEvent = {
    id:
      existingIndex >= 0
        ? events[existingIndex].id
        : crypto.randomUUID
          ? crypto.randomUUID()
          : String(Date.now()),
    ...eventData,
    mapLink: eventData.address
      ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(eventData.address)}`
      : '#'
  };

  if (existingIndex >= 0) {
    events[existingIndex] = newEvent;
  } else {
    events.push(newEvent);
  }

  localStorage.setItem('localEvents', JSON.stringify(events));
}

async function createEvent() {
  try {
    if (!token) {
      console.warn('Kein Login vorhanden – Termin wird im Testmodus gespeichert.');
    }

    clearEventFieldHighlights();
    const required = ['eventTitle', 'eventDate', 'eventAddress', 'eventMeetingTime', 'eventKickoffTime', 'eventDeadlineDate', 'eventDeadlineTime'];
    const missing = required.filter((id) => !el(id).value);
    if (missing.length) {
      highlightEventFields(missing);
      alert('Bitte Pflichtfelder ausfüllen');
      return;
    }

    const meetingTime = el('eventMeetingTime').value;
    const kickoffTime = el('eventKickoffTime').value;
    if (meetingTime >= kickoffTime) {
      highlightEventFields(['eventMeetingTime', 'eventKickoffTime']);
      alert('Die Treffzeit muss vor der Anstoßzeit liegen');
      return;   
    }
const eventDate = el('eventDate').value;
const deadlineDate = el('eventDeadlineDate').value;
const deadlineTime = el('eventDeadlineTime').value;
const deadlineValue = deadlineDate && deadlineTime ? `${deadlineDate}T${deadlineTime}` : '';

if (deadlineDate && eventDate && deadlineDate > eventDate) {
  highlightEventFields(['eventDate', 'eventDeadlineDate', 'eventDeadlineTime']);
  alert('Das Absagedatum darf nicht nach dem Spieltermin liegen!');
  return;
}
    const basePayload = {
      title: el('eventTitle').value,
      opponent: el('eventOpponent').value,
      homeAway: el('eventHomeAway').value,
      category: el('eventTitle').value,
      address: el('eventAddress').value,
      surface: el('eventSurface').value,
      meetingTime,
      kickoffTime,
      geo:
        el('eventAddress').dataset.lat && el('eventAddress').dataset.lng
          ? { lat: Number(el('eventAddress').dataset.lat), lng: Number(el('eventAddress').dataset.lng) }
          : undefined,
      responseDeadline: deadlineValue,
      notifyPlayers: el('eventNotify').checked,
      reminderHoursBefore: Number(el('eventReminderHours').value || 24)
    };

    if (basePayload.title === 'Training') {
      const seriesDates = getSeriesDates();
      const seriesMeetingTime = el('seriesMeetingTime').value || meetingTime;
      const seriesKickoffTime = el('seriesKickoffTime').value || kickoffTime;
      const seriesEndTime = el('seriesEndTime').value || seriesKickoffTime;
      const seriesDeadline = el('seriesDeadline').value || basePayload.responseDeadline;

      if (seriesMeetingTime >= seriesKickoffTime || seriesKickoffTime >= seriesEndTime) {
        alert('Die Treffzeit muss vor der Anstoßzeit liegen');
        return;
      }
      if (seriesDeadline && seriesDeadline.slice(14, 16) !== '00') {
        alert('Zu-/Absage bis darf nur volle Stunden enthalten.');
        return;
      }
     if (seriesDates && seriesDates.length) {
  for (const date of seriesDates) {
    const seriesDeadlineDate = seriesDeadline ? seriesDeadline.slice(0, 10) : '';

    if (seriesDeadlineDate && seriesDeadlineDate > date) {
      alert('Das Absagedatum darf nicht nach dem Spieltermin liegen!');
      return;
    }

    saveEventLocally({
      ...basePayload,
      date,
      meetingTime: seriesMeetingTime,
      kickoffTime: seriesKickoffTime,
      endTime: seriesEndTime,
      responseDeadline: seriesDeadline || basePayload.responseDeadline
    });
  }
} else {
  saveEventLocally({
    ...basePayload,
    date: el('eventDate').value
  });
}
} else {
  saveEventLocally({
    ...basePayload,
    date: el('eventDate').value
  });
}
    await loadEvents();
  } catch (e) {
    alert(`Speichern fehlgeschlagen: ${e.message}`);
  }
}

async function deleteEvent() {
  try {
    const id = selectedCalendarEventId || prompt('Bitte Event-ID für das Löschen eingeben:');
    if (!id) return;
    if (!currentUser) {
  console.warn('Kein Login vorhanden – Löschen im Testmodus erlaubt.');
}
    const events = JSON.parse(localStorage.getItem('localEvents') || '[]');
const filteredEvents = events.filter((event) => event.id !== id);
localStorage.setItem('localEvents', JSON.stringify(filteredEvents));
if (selectedCalendarEventId === id) selectedCalendarEventId = '';
await loadEvents();
  } catch (e) {
    alert(`Löschen fehlgeschlagen: ${e.message}`);
  }
}

async function loadEvents() {
  const isGitHubPages = window.location.hostname.includes('github.io');

  if (isGitHubPages) {
    const events = JSON.parse(localStorage.getItem('localEvents') || '[]');
    renderCalendar(events);
    el('opponentSuggestions').innerHTML = [...new Set(events.map((e) => e.opponent).filter(Boolean))]
      .map((x) => `<option value="${x}"></option>`)
      .join('');
    el('addressSuggestions').innerHTML = [...new Set(events.map((e) => e.address).filter(Boolean))]
      .map((x) => `<option value="${x}"></option>`)
      .join('');
    return;
  }

  try {
    const events = await api('/api/events');
    renderCalendar(events);
    el('opponentSuggestions').innerHTML = [...new Set(events.map((e) => e.opponent).filter(Boolean))]
      .map((x) => `<option value="${x}"></option>`)
      .join('');
    el('addressSuggestions').innerHTML = [...new Set(events.map((e) => e.address).filter(Boolean))]
      .map((x) => `<option value="${x}"></option>`)
      .join('');
  } catch (e) {
    const events = JSON.parse(localStorage.getItem('localEvents') || '[]');
    renderCalendar(events);
    el('opponentSuggestions').innerHTML = [...new Set(events.map((e) => e.opponent).filter(Boolean))]
      .map((x) => `<option value="${x}"></option>`)
      .join('');
    el('addressSuggestions').innerHTML = [...new Set(events.map((e) => e.address).filter(Boolean))]
      .map((x) => `<option value="${x}"></option>`)
      .join('');
  }
}

async function loadReminders() {
  const items = await api('/api/events/reminders');
  el('remindersList').innerHTML = items.length
    ? items.map((x) => `<div class="border rounded p-2 bg-violet-50 text-sm">${x.message} (Frist: ${new Date(x.responseDeadline).toLocaleString('de-DE')})</div>`).join('')
    : '<div class="text-sm text-slate-500">Aktuell keine fälligen Erinnerungen.</div>';
}

async function createNomination() {
  const select = el('nomPlayerId');
  const playerId = select.value;
  const playerName = select.options[select.selectedIndex]?.textContent || '';
  await api('/api/nominations', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ eventId: el('nomEventId').value, playerId, playerName })
  });
  await loadNominations(el('nomEventId').value);
}

async function answerNomination() {
  await api(`/api/nominations/${el('answerNomId').value}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ status: el('answerStatus').value, reason: el('answerReason').value })
  });
  if (el('nomEventId').value) await loadNominations(el('nomEventId').value);
}

async function loadNominations(eventId) {
  if (!eventId) return;
  const list = await api(`/api/nominations/${eventId}`);
  el('nomList').innerHTML = list
    .map((n) => `<div class="p-2 border rounded text-sm">ID ${n.id}: ${n.playerName || n.playerId} → <b>${n.status || 'Offen'}</b> ${n.reason ? `(${n.reason})` : ''}</div>`)
    .join('');
}

async function addLedger() {
  await api('/api/ledger', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ player: el('ledgerPlayer').value, amount: Number(el('ledgerAmount').value), type: el('ledgerType').value, reason: el('ledgerReason').value })
  });
  await loadLedger();
}

async function loadLedger() {
  const rows = await api('/api/ledger');
  const total = rows.reduce((acc, x) => acc + (x.type === 'Einnahme' ? x.amount : -x.amount), 0);
  el('ledgerList').innerHTML = `<div class="font-semibold">Saldo: ${total.toFixed(2)} €</div>${rows
    .map((r) => `<div class="p-2 border rounded text-sm">${r.player}: ${r.type} ${r.amount} € (${r.reason})</div>`)
    .join('')}`;
}

async function loadAgeGroups() {
  const ages = await api('/api/meta/age-groups');
  el('fAge').innerHTML = `<option value="">Altersklasse</option>${ages.map((a) => `<option value="${a}">${a}</option>`).join('')}`;
}

async function loadMaterials() {
  const mats = await api('/api/materials');
  el('materialSelect').innerHTML = mats.map((m) => `<option>${m}</option>`).join('');
  updateMaterialInfo();
}

function updateMaterialInfo() {
  el('materialInfo').textContent = `Ausgewähltes Material: ${el('materialSelect').value || '-'} | ${el('bibColor').value}es Leibchen | ${el('dummyColor').value}er Dummy`;
}

async function loadExercises() {
  const params = new URLSearchParams({ ageGroup: el('fAge').value, performance: el('fPerf').value, type: el('fType').value, fitness: el('fFit').value });
  const items = await api(`/api/exercises?${params.toString()}`);
  el('exerciseList').innerHTML = items
    .map((x) => `<article class="p-3 border rounded bg-slate-50"><h3 class="font-medium">${x.title}</h3><p class="text-xs">${x.ageGroup} · ${x.performance} · ${x.type} · ${x.fitness}</p><p class="text-sm mt-1">Material: ${(x.material || []).join(', ')}</p><p class="text-sm mt-1">${x.description}</p></article>`)
    .join('');
}
const tacticsMaterialConfig = [
  { label: 'Koordinationsleiter', options: ['Rot', 'Gelb'] },
  { label: 'Pylonen', options: ['Rot', 'Gelb', 'Blau', 'Weiß', 'Orange'] },
  { label: 'Trainingsdummy', options: ['Rot', 'Gelb', 'Blau', 'Weiß', 'Orange'] },
  { label: 'Markierscheiben', options: ['Orange', 'Blau', 'Gelb', 'Pink', 'Weiß', 'Schwarz'] },
  { label: 'Markierstreifen', options: ['Orange', 'Blau', 'Gelb', 'Pink', 'Weiß', 'Schwarz'] },
  { label: 'Markierscheiben mit Nummern', options: ['1', '2', '3', '4', '5', '6', '7', '8', '9', '10'] },
  { label: 'Markierhütchen', options: ['Orange', 'Blau', 'Gelb', 'Pink', 'Weiß', 'Schwarz'] },
  { label: 'Leibchen', options: ['Rot', 'Gelb', 'Blau', 'Weiß', 'Orange'] },
  { label: 'Kegelhürde', options: ['Rot', 'Gelb', 'Blau'] },
  { label: 'Minihürden Höhe 15 cm', options: ['Rot', 'Gelb', 'Blau'] },
  { label: 'Minihürden Höhe 30 cm', options: ['Rot', 'Gelb', 'Blau'] },
  { label: 'Minihürden Höhe 45 cm', options: ['Rot', 'Gelb', 'Blau'] },
  { label: 'Tore', options: ['1,20 x 0,80', '3,00 x 2,00', '5,00 x 2,00', '7,32 x 2,44'] },
  { label: 'Torwarttraining', options: ['Trainingsdummy aufblasbar', 'Koordinationskreuz'] },
  { label: 'Spielerauswahl', options: ['Rote', 'Blaue', 'Gelbe', 'Weiße'] }
];
const materialSvgImageCache = new Map();

function getMaterialSvgMarkup(material, value) {
  if (material === 'Pylonen') {
    const colorMap = {
      Rot: '#E10600',
      Gelb: '#F4D03F',
      Blau: '#2D9CDB',
      Weiß: '#F8FAFC',
      Orange: '#F77F00'
    };

    const fill = colorMap[value] || '#F77F00';
    const sideShade = value === 'Weiß' ? '#d6dde6' : '#b21f10';
    const stripe = '#ffffff';

    return `
      <svg
        width="100%"
        height="100%"
        class="max-w-[92px] max-h-[150px]"
        preserveAspectRatio="xMidYMid meet"
        viewBox="0 0 180 220"
        xmlns="http://www.w3.org/2000/svg"
        role="img"
        aria-label="Pylone ${value}"
      >
        <ellipse cx="90" cy="198" rx="22" ry="5" fill="rgba(15,23,42,0.10)" />
        <ellipse cx="90" cy="173" rx="34" ry="13" fill="#05070b" />
        <path d="M90 24 C100 56 109 95 118 166 H62 C71 95 80 56 90 24 Z" fill="${fill}" />
        <path d="M90 24 C101 58 110 96 118 166 H101 C99 116 96 72 90 24 Z" fill="${sideShade}" opacity="0.22" />
        <path d="M83 46 C87 73 91 107 94 157 H103 C104 124 109 85 114 48 Z" fill="${stripe}" opacity="0.95" />
      </svg>
    `;
  }

  if (material === 'Markierhütchen') {
    const colorMap = {
      Orange: '#F77F00',
      Blau: '#2D9CDB',
      Gelb: '#F4D03F',
      Pink: '#E64980',
      Weiß: '#F8FAFC',
      Schwarz: '#111827'
    };

    const fill = colorMap[value] || '#F77F00';
    const topFill = value === 'Weiß' ? '#E2E8F0' : fill;
    const stripe = value === 'Schwarz' ? 'rgba(255,255,255,0.45)' : 'rgba(255,255,255,0.92)';

    return `
      <svg
        width="100%"
        height="100%"
        class="max-w-[126px] max-h-[90px]"
        preserveAspectRatio="xMidYMid meet"
        viewBox="0 0 180 120"
        xmlns="http://www.w3.org/2000/svg"
        role="img"
        aria-label="Markierhütchen ${value}"
      >
        <ellipse cx="90" cy="104" rx="34" ry="5" fill="rgba(15,23,42,0.08)" />
        <ellipse cx="90" cy="87" rx="44" ry="12" fill="#05070b" />
        <path d="M48 86 C58 54 76 31 90 22 C104 31 122 54 132 86 C119 95 61 95 48 86 Z" fill="${fill}" />
        <ellipse cx="90" cy="30" rx="15" ry="6" fill="${topFill}" />
        <path d="M84 36 C89 48 94 61 97 79 H105 C101 60 106 46 114 33 Z" fill="${stripe}" />
      </svg>
    `;
  }

  return null;
}

function getMaterialSvgPreviewMarkup(material, value) {
  const svg = getMaterialSvgMarkup(material, value);
  if (!svg) return null;

  return `
    <div class="w-full h-full flex items-center justify-center p-1 overflow-hidden">
      ${svg}
    </div>
  `;
}

    function getMaterialPreviewMarkup(material, value) {
  const svgMarkup = getMaterialSvgPreviewMarkup(material, value);
  if (svgMarkup) return svgMarkup;

  if (material === 'Koordinationsleiter') {
    const colorMap = {
      Rot: '#D95F02',
      Gelb: '#E6C229'
    };

    const fill = colorMap[value] || '#D95F02';
    const rungFill = value === 'Gelb' ? '#D4B21A' : '#C55300';
    const gloss = value === 'Gelb' ? 'rgba(255,255,255,0.16)' : 'rgba(255,255,255,0.12)';

    return `
      <div class="w-full h-full flex items-center justify-center p-2 overflow-hidden">
        <svg
          width="100%"
          height="100%"
          class="max-w-[180px] max-h-[90px]"
          viewBox="0 0 260 110"
          xmlns="http://www.w3.org/2000/svg"
          role="img"
          aria-label="Koordinationsleiter ${value}"
        >
          <ellipse
            cx="130"
            cy="82"
            rx="94"
            ry="8"
            fill="rgba(15,23,42,0.08)"
          />
          <g transform="translate(20 18) rotate(-1.8 110 28)">
            <rect x="0" y="8" width="220" height="5" rx="2.5" fill="${fill}" />
            <rect x="0" y="52" width="220" height="5" rx="2.5" fill="${fill}" />
            <rect x="0" y="8" width="220" height="1.5" rx="1" fill="${gloss}" />
            <rect x="12" y="6" width="5" height="54" rx="2.5" fill="${rungFill}" />
            <rect x="38" y="6" width="5" height="54" rx="2.5" fill="${rungFill}" />
            <rect x="64" y="6" width="5" height="54" rx="2.5" fill="${rungFill}" />
            <rect x="90" y="6" width="5" height="54" rx="2.5" fill="${rungFill}" />
            <rect x="116" y="6" width="5" height="54" rx="2.5" fill="${rungFill}" />
            <rect x="142" y="6" width="5" height="54" rx="2.5" fill="${rungFill}" />
            <rect x="168" y="6" width="5" height="54" rx="2.5" fill="${rungFill}" />
            <rect x="194" y="6" width="5" height="54" rx="2.5" fill="${rungFill}" />
          </g>
        </svg>
      </div>
    `;
  }

  if (material === 'Markierscheiben') {
    const colorMap = {
      Orange: '#F77F00',
      Blau: '#2D9CDB',
      Gelb: '#F4D03F',
      Pink: '#E64980',
      Weiß: '#F8FAFC',
      Schwarz: '#1F2937'
    };

    const fill = colorMap[value] || '#F77F00';
    const topGlow = value === 'Schwarz' ? 'rgba(255,255,255,0.10)' : 'rgba(255,255,255,0.18)';
    const centerTone = value === 'Weiß' ? 'rgba(203,213,225,0.70)' : 'rgba(255,255,255,0.14)';

    return `
      <div class="w-full h-full flex items-center justify-center p-2 overflow-hidden">
        <svg
          width="100%"
          height="100%"
          class="max-w-[150px] max-h-[88px]"
          preserveAspectRatio="xMidYMid meet"
          viewBox="0 0 220 120"
          xmlns="http://www.w3.org/2000/svg"
          role="img"
          aria-label="Markierscheiben ${value}"
        >
          <ellipse
            cx="110"
            cy="82"
            rx="52"
            ry="9"
            fill="rgba(15,23,42,0.08)"
          />
          <path
            d="M56 68 C64 52, 156 52, 164 68 C156 80, 64 80, 56 68 Z"
            fill="${fill}"
          />
          <path
            d="M60 65 C70 57, 150 57, 160 65 C150 70, 70 70, 60 65 Z"
            fill="${topGlow}"
          />
          <ellipse
            cx="110"
            cy="61"
            rx="18"
            ry="5.5"
            fill="${centerTone}"
          />
        </svg>
      </div>
    `;
  }

  return `
    <div class="w-full h-full flex flex-col items-center justify-center text-center p-4">
      <div class="text-sm text-slate-500 mb-2">${material}</div>
      <div class="text-2xl font-semibold text-slate-800">${value}</div>
    </div>
  `;
}
let activeTacticsSelection = null;
function updateTacticsPreview(activeSelect = null) {
  const previewBox = el('tacticsPreviewBox');
  if (!previewBox) return;

  if (activeSelect && activeSelect.value) {
    activeTacticsSelection = {
      material: activeSelect.dataset.tacticsMaterial,
      value: activeSelect.value
    };
  }

  if (!activeTacticsSelection || !activeTacticsSelection.value) {
    previewBox.textContent = 'Keine Auswahl';
    return;
  }

  const { material, value } = activeTacticsSelection;
  previewBox.innerHTML = `
  <div
    id="tacticsPreviewDraggable"
    class="w-full h-full cursor-grab touch-none select-none"
    data-material="${material}"
    data-value="${value}"
  >
    ${getMaterialPreviewMarkup(material, value)}
  </div>
`;
}

function renderTacticsMaterialFields() {
  const host = el('tacticsMaterialFields');
  if (!host) return;

  host.innerHTML = tacticsMaterialConfig
    .map(
      (field, index) => `
        <label class="grid gap-1 min-w-0">
          <span
            class="block break-words leading-tight"
            style="font-size: 12px; line-height: 1.15; min-height: 1.7rem; font-weight: 600;"
          >
            ${field.label}
          </span>
          <select
            id="tacticsMaterialSelect${index}"
            class="w-full min-w-0 max-w-full border rounded bg-white"
            style="font-size: 12px; line-height: 1.1; font-weight: 500; padding: 8px 28px 8px 10px;"
            data-tactics-material="${field.label}"
          >
            <option value="">Bitte wählen</option>
            ${field.options.map((option) => `<option value="${option}">${option}</option>`).join('')}
          </select>
        </label>
      `
    )
    .join('');

  const selects = Array.from(host.querySelectorAll('[data-tactics-material]'));

  selects.forEach((select) => {
    select.addEventListener('change', (event) => {
      const current = event.currentTarget;

      if (current.value) {
        selects.forEach((other) => {
          if (other !== current) other.value = '';
        });

        updateTacticsPreview(current);
        return;
      }

      activeTacticsSelection = null;
      updateTacticsPreview();
    });
  });

  updateTacticsPreview();
}
let coachingAreaDragState = null;

function getCanvasDropPoint(canvas, clientX, clientY) {
  const rect = canvas.getBoundingClientRect();

  const xRatio = Math.min(1, Math.max(0, (clientX - rect.left) / rect.width));
  const yRatio = Math.min(1, Math.max(0, (clientY - rect.top) / rect.height));

  return { xRatio, yRatio };
}

function createDragGhost(material, value, clientX, clientY) {
  const ghost = document.createElement('div');
  ghost.id = 'tacticsDragGhost';
  ghost.style.position = 'fixed';
  ghost.style.left = '0';
  ghost.style.top = '0';
  ghost.style.width = '110px';
  ghost.style.height = '110px';
  ghost.style.pointerEvents = 'none';
  ghost.style.zIndex = '9999';
  ghost.style.transform = `translate(${clientX - 55}px, ${clientY - 55}px)`;
  ghost.innerHTML = getMaterialPreviewMarkup(material, value);
  document.body.appendChild(ghost);
  return ghost;
}

function moveDragGhost(ghost, clientX, clientY) {
  if (!ghost) return;
  ghost.style.transform = `translate(${clientX - 55}px, ${clientY - 55}px)`;
}

function removeDragGhost() {
  const ghost = document.getElementById('tacticsDragGhost');
  if (ghost) ghost.remove();
}

function initCoachingAreaDragAndDrop() {
  const previewBox = el('tacticsPreviewBox');
  const canvas = el('tacticsCanvas');
  if (!previewBox || !canvas) return;

  previewBox.addEventListener('pointerdown', (event) => {
    const draggable = event.target.closest('#tacticsPreviewDraggable');
    if (!draggable) return;

    const material = activeTacticsSelection?.material;
const value = activeTacticsSelection?.value;
if (!material || !value) return;

    event.preventDefault();


    coachingAreaDragState = {
      pointerId: event.pointerId,
      material,
      value,
      ghost: createDragGhost(material, value, event.clientX, event.clientY)
    };
  });

  window.addEventListener('pointermove', (event) => {
    if (!coachingAreaDragState) return;
    moveDragGhost(coachingAreaDragState.ghost, event.clientX, event.clientY);
  });

  window.addEventListener('pointerup', (event) => {
    if (!coachingAreaDragState) return;

    const { material, value } = coachingAreaDragState;
    const rect = canvas.getBoundingClientRect();

    const isInsideCanvas =
      event.clientX >= rect.left &&
      event.clientX <= rect.right &&
      event.clientY >= rect.top &&
      event.clientY <= rect.bottom;

    if (isInsideCanvas && window.addPlacedTacticsItem) {
      const point = getCanvasDropPoint(canvas, event.clientX, event.clientY);

      window.addPlacedTacticsItem({
        material,
        value,
        xRatio: point.xRatio,
        yRatio: point.yRatio
      });
    }

    removeDragGhost();
    coachingAreaDragState = null;
  });

  window.addEventListener('pointercancel', () => {
    removeDragGhost();
    coachingAreaDragState = null;
  });
}
function setupLineupCanvas() {
  const canvas = el('lineupCanvas');
  const wrap = el('lineupCanvasWrap');
  if (!canvas || !wrap) return;

  const ctx = canvas.getContext('2d');
  if (!ctx) return;

  const getPitchGreen = () => {
    const selectors = [
      '#createEventBtn',
      '#saveMemberBtn',
      '#saveEventBtn',
      'button.bg-green-600',
      'button.bg-green-500',
      'button.bg-emerald-600',
      'button.bg-emerald-500'
    ];

    for (const selector of selectors) {
      const node = document.querySelector(selector);
      if (!node) continue;
      const color = getComputedStyle(node).backgroundColor;
      if (color && color !== 'rgba(0, 0, 0, 0)' && color !== 'transparent') {
        return color;
      }
    }

    return '#16a34a';
  };

  const resizeCanvas = () => {
    const pitchRatio = 68 / 105;
    const availableWidth = Math.min(wrap.clientWidth || 1100, 2060);
    const maxHeight = Math.min(Math.max(window.innerHeight * 0.88, 900), 1370);

    let drawWidth = availableWidth;
    let drawHeight = drawWidth / pitchRatio;

    if (drawHeight > maxHeight) {
      drawHeight = maxHeight;
      drawWidth = drawHeight * pitchRatio;
    }

    const dpr = window.devicePixelRatio || 1;

    canvas.style.width = `${Math.round(drawWidth)}px`;
    canvas.style.height = `${Math.round(drawHeight)}px`;
    canvas.style.display = 'block';
    canvas.style.maxWidth = '100%';
    canvas.style.borderRadius = '14px';
    canvas.style.cursor = 'crosshair';

    canvas.width = Math.round(drawWidth * dpr);
    canvas.height = Math.round(drawHeight * dpr);

    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    return { drawWidth, drawHeight };
  };

  const getLayout = (drawWidth, drawHeight) => {
    const padding = 24;
    const fieldX = padding;
    const fieldY = padding;
    const fieldWidth = drawWidth - padding * 2;
    const fieldHeight = drawHeight - padding * 2;
    const scale = fieldWidth / 68;

    return { fieldX, fieldY, fieldWidth, fieldHeight, scale };
  };

  const drawGrass = (drawWidth, drawHeight, fieldX, fieldY, fieldWidth, fieldHeight) => {
    const stripeCount = 12;
    const base = getPitchGreen();

    ctx.fillStyle = base;
    ctx.fillRect(0, 0, drawWidth, drawHeight);

    for (let i = 0; i < stripeCount; i += 1) {
      ctx.fillStyle = i % 2 === 0 ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.04)';
      const stripeHeight = fieldHeight / stripeCount;
      ctx.fillRect(fieldX, fieldY + i * stripeHeight, fieldWidth, stripeHeight);
    }
  };

  const drawCornerArc = (x, y, radius, startAngle, endAngle) => {
    ctx.beginPath();
    ctx.arc(x, y, radius, startAngle, endAngle);
    ctx.stroke();
  };

  const drawPenaltyArc = (x, y, radius, penaltyLineY, topSide) => {
    const offset = Math.min(radius, Math.abs(penaltyLineY - y));
    const angle = Math.asin(offset / radius);

    ctx.beginPath();

    if (topSide) {
      ctx.arc(x, y, radius, angle, Math.PI - angle);
    } else {
      ctx.arc(x, y, radius, Math.PI + angle, Math.PI * 2 - angle);
    }

    ctx.stroke();
  };

  const drawEnd = (isTop, fieldX, fieldY, fieldWidth, fieldHeight, scale) => {
    const goalWidth = 7.32;
    const goalDepth = 2.4;
    const goalAreaWidth = 18.32;
    const goalAreaDepth = 5.5;
    const penaltyAreaWidth = 40.32;
    const penaltyAreaDepth = 16.5;
    const penaltySpotDistance = 11;
    const penaltyArcRadius = 9.15;

    const centerX = fieldX + fieldWidth / 2;

    const goalX = centerX - (goalWidth * scale) / 2;
    const goalAreaX = centerX - (goalAreaWidth * scale) / 2;
    const penaltyAreaX = centerX - (penaltyAreaWidth * scale) / 2;

    const goalWidthPx = goalWidth * scale;
    const goalDepthPx = goalDepth * scale;
    const goalAreaWidthPx = goalAreaWidth * scale;
    const goalAreaDepthPx = goalAreaDepth * scale;
    const penaltyAreaWidthPx = penaltyAreaWidth * scale;
    const penaltyAreaDepthPx = penaltyAreaDepth * scale;
    const spotRadius = Math.max(3, scale * 0.22);

    if (isTop) {
      ctx.strokeRect(goalAreaX, fieldY, goalAreaWidthPx, goalAreaDepthPx);
      ctx.strokeRect(penaltyAreaX, fieldY, penaltyAreaWidthPx, penaltyAreaDepthPx);
      ctx.strokeRect(goalX, fieldY - goalDepthPx, goalWidthPx, goalDepthPx);

      const spotY = fieldY + penaltySpotDistance * scale;

      ctx.beginPath();
      ctx.arc(centerX, spotY, spotRadius, 0, Math.PI * 2);
      ctx.fill();

      drawPenaltyArc(centerX, spotY, penaltyArcRadius * scale, fieldY + penaltyAreaDepthPx, true);
      return;
    }

    const goalAreaY = fieldY + fieldHeight - goalAreaDepthPx;
    const penaltyAreaY = fieldY + fieldHeight - penaltyAreaDepthPx;
    const goalY = fieldY + fieldHeight;

    ctx.strokeRect(goalAreaX, goalAreaY, goalAreaWidthPx, goalAreaDepthPx);
    ctx.strokeRect(penaltyAreaX, penaltyAreaY, penaltyAreaWidthPx, penaltyAreaDepthPx);
    ctx.strokeRect(goalX, goalY, goalWidthPx, goalDepthPx);

    const spotY = fieldY + fieldHeight - penaltySpotDistance * scale;

    ctx.beginPath();
    ctx.arc(centerX, spotY, spotRadius, 0, Math.PI * 2);
    ctx.fill();

    drawPenaltyArc(centerX, spotY, penaltyArcRadius * scale, penaltyAreaY, false);
  };

  const drawPitch = (drawWidth, drawHeight) => {
    const { fieldX, fieldY, fieldWidth, fieldHeight, scale } = getLayout(drawWidth, drawHeight);
    const centerX = fieldX + fieldWidth / 2;
    const centerY = fieldY + fieldHeight / 2;
    const centerCircleRadius = 9.15 * scale;
    const centerSpotRadius = Math.max(3, scale * 0.22);
    const cornerRadius = Math.max(8, scale);

    ctx.clearRect(0, 0, drawWidth, drawHeight);
    drawGrass(drawWidth, drawHeight, fieldX, fieldY, fieldWidth, fieldHeight);

    ctx.strokeStyle = 'rgba(255,255,255,0.96)';
    ctx.fillStyle = 'rgba(255,255,255,0.96)';
    ctx.lineWidth = 2.5;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    ctx.strokeRect(fieldX, fieldY, fieldWidth, fieldHeight);

    ctx.beginPath();
    ctx.moveTo(fieldX, centerY);
    ctx.lineTo(fieldX + fieldWidth, centerY);
    ctx.stroke();

    ctx.beginPath();
    ctx.arc(centerX, centerY, centerCircleRadius, 0, Math.PI * 2);
    ctx.stroke();

    ctx.beginPath();
    ctx.arc(centerX, centerY, centerSpotRadius, 0, Math.PI * 2);
    ctx.fill();

    drawEnd(true, fieldX, fieldY, fieldWidth, fieldHeight, scale);
    drawEnd(false, fieldX, fieldY, fieldWidth, fieldHeight, scale);

    drawCornerArc(fieldX, fieldY, cornerRadius, 0, Math.PI / 2);
    drawCornerArc(fieldX + fieldWidth, fieldY, cornerRadius, Math.PI / 2, Math.PI);
    drawCornerArc(fieldX, fieldY + fieldHeight, cornerRadius, -Math.PI / 2, 0);
    drawCornerArc(fieldX + fieldWidth, fieldY + fieldHeight, cornerRadius, Math.PI, Math.PI * 1.5);
  };

  const draw = () => {
    const { drawWidth, drawHeight } = resizeCanvas();
    drawPitch(drawWidth, drawHeight);
  };

  window.addEventListener('resize', draw);

  if (window.ResizeObserver) {
    new ResizeObserver(draw).observe(wrap);
  }

  draw();
}
function setupCanvas() {
  const canvas = el('tacticsCanvas');
  const wrap = el('tacticsCanvasWrap');
  const section = el('tacticsEditorSection');
  if (!canvas || !wrap) return;

  const ctx = canvas.getContext('2d');
  const placed = [];
  let selectedPlacedItemId = null;
  let placedItemIdCounter = 1;
window.addPlacedTacticsItem = (item) => {
  const placedItem = {
    id: placedItemIdCounter++,
    material: item.material || activeTacticsSelection?.material || '',
    value: item.value || activeTacticsSelection?.value || '',
    xRatio: item.xRatio,
    yRatio: item.yRatio,
    scale: item.scale ?? 1,
    rotation: item.rotation ?? 0
  };

  placed.push(placedItem);
  selectedPlacedItemId = placedItem.id;
  updateTacticsEditPanel();
  draw();
};
  const getSelectedPlacedItem = () =>
  placed.find((item) => item.id === selectedPlacedItemId) || null;

const updateTacticsEditPanel = () => {
  const emptyState = el('tacticsEditEmpty');
  const controls = el('tacticsEditControls');
  const selectedLabel = el('tacticsSelectedLabel');

  if (!emptyState || !controls || !selectedLabel) return;

  const selectedItem = getSelectedPlacedItem();

  if (!selectedItem) {
    emptyState.classList.remove('hidden');
    controls.classList.add('hidden');
    selectedLabel.textContent = '';
    return;
  }

  emptyState.classList.add('hidden');
  controls.classList.remove('hidden');
  selectedLabel.textContent = `${selectedItem.material} – ${selectedItem.value} | Größe ${Math.round((selectedItem.scale ?? 1) * 100)}% | Rotation ${selectedItem.rotation ?? 0}°`;
};

const getPlacedItemHitbox = (item, drawWidth, drawHeight) => {
  const x = item.xRatio * drawWidth;
  const y = item.yRatio * drawHeight;
  const scale = item.scale ?? 1;

  if (item.material === 'Pylonen') {
  return { item, x, y, halfWidth: 22 * scale, halfHeight: 32 * scale };
}

  if (item.material === 'Markierscheiben') {
  return { item, x, y, halfWidth: 26 * scale, halfHeight: 10 * scale };
}

  if (item.material === 'Koordinationsleiter') {
    return { item, x, y, halfWidth: 16 * scale, halfHeight: 38 * scale };
  }
if (item.material === 'Markierhütchen') {
  return { item, x, y, halfWidth: 34 * scale, halfHeight: 24 * scale };
}
  return { item, x, y, halfWidth: 34 * scale, halfHeight: 16 * scale };
};

const getPlacedItemAtPoint = (clientX, clientY) => {
  const rect = canvas.getBoundingClientRect();
  const drawWidth = rect.width;
  const drawHeight = rect.height;

  const pointerX = clamp(clientX - rect.left, 0, drawWidth);
  const pointerY = clamp(clientY - rect.top, 0, drawHeight);

  for (let i = placed.length - 1; i >= 0; i -= 1) {
    const hitbox = getPlacedItemHitbox(placed[i], drawWidth, drawHeight);

    const insideX =
      pointerX >= hitbox.x - hitbox.halfWidth &&
      pointerX <= hitbox.x + hitbox.halfWidth;

    const insideY =
      pointerY >= hitbox.y - hitbox.halfHeight &&
      pointerY <= hitbox.y + hitbox.halfHeight;

    if (insideX && insideY) {
      return hitbox.item;
    }
  }

  return null;
};
  let selected = '⚽';

  const clamp = (value, min = 0, max = 1) => Math.min(max, Math.max(min, value));

  const getPitchGreen = () => {
    const selectors = [
      '#createEventBtn',
      '#saveMemberBtn',
      '#saveEventBtn',
      'button.bg-green-600',
      'button.bg-green-500',
      'button.bg-emerald-600',
      'button.bg-emerald-500'
    ];

    for (const selector of selectors) {
      const node = document.querySelector(selector);
      if (!node) continue;
      const color = getComputedStyle(node).backgroundColor;
      if (color && color !== 'rgba(0, 0, 0, 0)' && color !== 'transparent') {
        return color;
      }
    }

    return '#16a34a';
  };

  const resizeCanvas = () => {
    const pitchRatio = 68 / 105;
    const availableWidth = Math.min(wrap.clientWidth || 1100, 2060);
    const maxHeight = Math.min(Math.max(window.innerHeight * 0.88, 900), 1370);

    let drawWidth = availableWidth;
    let drawHeight = drawWidth / pitchRatio;

    if (drawHeight > maxHeight) {
      drawHeight = maxHeight;
      drawWidth = drawHeight * pitchRatio;
    }

    const dpr = window.devicePixelRatio || 1;

    canvas.style.width = `${Math.round(drawWidth)}px`;
    canvas.style.height = `${Math.round(drawHeight)}px`;
    canvas.style.display = 'block';
    canvas.style.maxWidth = '100%';
    canvas.style.borderRadius = '14px';
    canvas.style.cursor = 'crosshair';

    canvas.width = Math.round(drawWidth * dpr);
    canvas.height = Math.round(drawHeight * dpr);

    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    return { drawWidth, drawHeight };
  };

  const getLayout = (drawWidth, drawHeight) => {
    const padding = 24;
    const fieldX = padding;
    const fieldY = padding;
    const fieldWidth = drawWidth - padding * 2;
    const fieldHeight = drawHeight - padding * 2;
    const scale = fieldWidth / 68;

    return { fieldX, fieldY, fieldWidth, fieldHeight, scale };
  };

  const drawGrass = (drawWidth, drawHeight, fieldX, fieldY, fieldWidth, fieldHeight) => {
    const stripeCount = 12;
    const base = getPitchGreen();

    ctx.fillStyle = base;
    ctx.fillRect(0, 0, drawWidth, drawHeight);

    for (let i = 0; i < stripeCount; i += 1) {
      ctx.fillStyle = i % 2 === 0 ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.04)';
      const stripeHeight = fieldHeight / stripeCount;
      ctx.fillRect(fieldX, fieldY + i * stripeHeight, fieldWidth, stripeHeight);
    }
  };

  const drawCornerArc = (x, y, radius, startAngle, endAngle) => {
    ctx.beginPath();
    ctx.arc(x, y, radius, startAngle, endAngle);
    ctx.stroke();
  };

  const drawPenaltyArc = (x, y, radius, penaltyLineY, topSide) => {
  const offset = Math.min(radius, Math.abs(penaltyLineY - y));
  const angle = Math.asin(offset / radius);

  ctx.beginPath();

  if (topSide) {
    ctx.arc(x, y, radius, angle, Math.PI - angle);
  } else {
    ctx.arc(x, y, radius, Math.PI + angle, Math.PI * 2 - angle);
  }

  ctx.stroke();
    };

  const drawEnd = (isTop, fieldX, fieldY, fieldWidth, fieldHeight, scale) => {
    const goalWidth = 7.32;
    const goalDepth = 2.4;
    const goalAreaWidth = 18.32;
    const goalAreaDepth = 5.5;
    const penaltyAreaWidth = 40.32;
    const penaltyAreaDepth = 16.5;
    const penaltySpotDistance = 11;
    const penaltyArcRadius = 9.15;

    const centerX = fieldX + fieldWidth / 2;

    const goalX = centerX - (goalWidth * scale) / 2;
    const goalAreaX = centerX - (goalAreaWidth * scale) / 2;
    const penaltyAreaX = centerX - (penaltyAreaWidth * scale) / 2;

    const goalWidthPx = goalWidth * scale;
    const goalDepthPx = goalDepth * scale;
    const goalAreaWidthPx = goalAreaWidth * scale;
    const goalAreaDepthPx = goalAreaDepth * scale;
    const penaltyAreaWidthPx = penaltyAreaWidth * scale;
    const penaltyAreaDepthPx = penaltyAreaDepth * scale;
    const spotRadius = Math.max(3, scale * 0.22);

    if (isTop) {
      ctx.strokeRect(goalAreaX, fieldY, goalAreaWidthPx, goalAreaDepthPx);
      ctx.strokeRect(penaltyAreaX, fieldY, penaltyAreaWidthPx, penaltyAreaDepthPx);
      ctx.strokeRect(goalX, fieldY - goalDepthPx, goalWidthPx, goalDepthPx);

      const spotY = fieldY + penaltySpotDistance * scale;

      ctx.beginPath();
      ctx.arc(centerX, spotY, spotRadius, 0, Math.PI * 2);
      ctx.fill();

      drawPenaltyArc(centerX, spotY, penaltyArcRadius * scale, fieldY + penaltyAreaDepthPx, true);
      return;
    }

    const goalAreaY = fieldY + fieldHeight - goalAreaDepthPx;
    const penaltyAreaY = fieldY + fieldHeight - penaltyAreaDepthPx;
    const goalY = fieldY + fieldHeight;

    ctx.strokeRect(goalAreaX, goalAreaY, goalAreaWidthPx, goalAreaDepthPx);
    ctx.strokeRect(penaltyAreaX, penaltyAreaY, penaltyAreaWidthPx, penaltyAreaDepthPx);
    ctx.strokeRect(goalX, goalY, goalWidthPx, goalDepthPx);

    const spotY = fieldY + fieldHeight - penaltySpotDistance * scale;

    ctx.beginPath();
    ctx.arc(centerX, spotY, spotRadius, 0, Math.PI * 2);
    ctx.fill();

    drawPenaltyArc(centerX, spotY, penaltyArcRadius * scale, penaltyAreaY, false);
  };

  const drawPitch = (drawWidth, drawHeight) => {
    const { fieldX, fieldY, fieldWidth, fieldHeight, scale } = getLayout(drawWidth, drawHeight);
    const centerX = fieldX + fieldWidth / 2;
    const centerY = fieldY + fieldHeight / 2;
    const centerCircleRadius = 9.15 * scale;
    const centerSpotRadius = Math.max(3, scale * 0.22);
    const cornerRadius = Math.max(8, scale);

    ctx.clearRect(0, 0, drawWidth, drawHeight);
    drawGrass(drawWidth, drawHeight, fieldX, fieldY, fieldWidth, fieldHeight);

    ctx.strokeStyle = 'rgba(255,255,255,0.96)';
    ctx.fillStyle = 'rgba(255,255,255,0.96)';
    ctx.lineWidth = 2.5;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    ctx.strokeRect(fieldX, fieldY, fieldWidth, fieldHeight);

    ctx.beginPath();
    ctx.moveTo(fieldX, centerY);
    ctx.lineTo(fieldX + fieldWidth, centerY);
    ctx.stroke();

    ctx.beginPath();
    ctx.arc(centerX, centerY, centerCircleRadius, 0, Math.PI * 2);
    ctx.stroke();

    ctx.beginPath();
    ctx.arc(centerX, centerY, centerSpotRadius, 0, Math.PI * 2);
    ctx.fill();

    drawEnd(true, fieldX, fieldY, fieldWidth, fieldHeight, scale);
    drawEnd(false, fieldX, fieldY, fieldWidth, fieldHeight, scale);

    drawCornerArc(fieldX, fieldY, cornerRadius, 0, Math.PI / 2);
    drawCornerArc(fieldX + fieldWidth, fieldY, cornerRadius, Math.PI / 2, Math.PI);
    drawCornerArc(fieldX, fieldY + fieldHeight, cornerRadius, -Math.PI / 2, 0);
    drawCornerArc(fieldX + fieldWidth, fieldY + fieldHeight, cornerRadius, Math.PI, Math.PI * 1.5);
  };

  const pointFromClick = (clientX, clientY) => {
    const rect = canvas.getBoundingClientRect();
    return {
      xRatio: clamp((clientX - rect.left) / rect.width),
      yRatio: clamp((clientY - rect.top) / rect.height)
    };
  };
const drawCanvasMaterialItem = (item, x, y) => {
  const scale = item.scale ?? 1;
  const rotation = ((item.rotation ?? 0) * Math.PI) / 180;
  const isSelected = item.id === selectedPlacedItemId;

  const applyTransform = () => {
    ctx.translate(x, y);
    ctx.rotate(rotation);
    ctx.scale(scale, scale);
  };

  const applySelectionStyle = () => {
    if (!isSelected) return;
    ctx.shadowColor = 'rgba(59, 130, 246, 0.35)';
    ctx.shadowBlur = 10;
  };

  if (item.material === 'Pylonen') {
  const colorMap = {
    Rot: '#E10600',
    Gelb: '#F4D03F',
    Blau: '#2D9CDB',
    Weiß: '#F8FAFC',
    Orange: '#F77F00'
  };

  const fill = colorMap[item.value] || '#F77F00';
  const sideShade = item.value === 'Weiß' ? 'rgba(203,213,225,0.95)' : 'rgba(0,0,0,0.12)';
  const stripe = item.value === 'Weiß' ? 'rgba(255,255,255,0.92)' : 'rgba(255,255,255,0.96)';

  ctx.save();
  applyTransform();
  applySelectionStyle();

  ctx.fillStyle = 'rgba(15,23,42,0.10)';
  ctx.beginPath();
  ctx.ellipse(0, 27, 22, 5.5, 0, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = '#05070b';
  ctx.beginPath();
  ctx.ellipse(0, 2, 34, 14, 0, 0, Math.PI * 2);
  ctx.fill();
const drawSvgMaterial = (width, height) => {
  const svg = getMaterialSvgMarkup(item.material, item.value);
  if (!svg) return false;

  const cacheKey = `${item.material}:${item.value}`;
  let img = materialSvgImageCache.get(cacheKey);

  if (!img) {
    img = new Image();
    img.onload = () => requestAnimationFrame(draw);
    img.src = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
    materialSvgImageCache.set(cacheKey, img);
  }

  ctx.save();
  applyTransform();
  applySelectionStyle();

  if (img.complete && img.naturalWidth > 0) {
    ctx.drawImage(img, -width / 2, -height / 2, width, height);
  }

  ctx.restore();
  return true;
};
  ctx.fillStyle = fill;
  ctx.beginPath();
  ctx.moveTo(0, -46);
  ctx.lineTo(28, -6);
  ctx.lineTo(15, -6);
  ctx.lineTo(0, -10);
  ctx.lineTo(-15, -6);
  ctx.lineTo(-28, -6);
  ctx.closePath();
  ctx.fill();

  ctx.fillStyle = sideShade;
  ctx.beginPath();
  ctx.moveTo(0, -46);
  ctx.lineTo(28, -6);
  ctx.lineTo(11, -6);
  ctx.closePath();
  ctx.fill();

  ctx.fillStyle = stripe;
  ctx.beginPath();
  ctx.moveTo(-8, -34);
  ctx.bezierCurveTo(-3, -18, 1, -2, 4, 16);
  ctx.lineTo(12, 16);
  ctx.bezierCurveTo(13, -2, 17, -18, 22, -32);
  ctx.closePath();
  ctx.fill();

  ctx.restore();
  return;
}

  if (item.material === 'Markierscheiben') {
  const colorMap = {
    Orange: '#F77F00',
    Blau: '#2D9CDB',
    Gelb: '#F4D03F',
    Pink: '#E64980',
    Weiß: '#F8FAFC',
    Schwarz: '#1F2937'
  };

  const fill = colorMap[item.value] || '#F77F00';
  const topGlow = item.value === 'Schwarz' ? 'rgba(255,255,255,0.10)' : 'rgba(255,255,255,0.18)';
  const centerTone = item.value === 'Weiß' ? 'rgba(203,213,225,0.70)' : 'rgba(255,255,255,0.14)';

  ctx.save();
  applyTransform();
  applySelectionStyle();

  ctx.fillStyle = 'rgba(15,23,42,0.08)';
  ctx.beginPath();
  ctx.ellipse(0, 18, 26, 4.5, 0, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = fill;
  ctx.beginPath();
  ctx.moveTo(-28, 4);
  ctx.bezierCurveTo(-20, -12, 20, -12, 28, 4);
  ctx.bezierCurveTo(20, 12, -20, 12, -28, 4);
  ctx.closePath();
  ctx.fill();

  ctx.fillStyle = topGlow;
  ctx.beginPath();
  ctx.moveTo(-24, 1);
  ctx.bezierCurveTo(-14, -7, 14, -7, 24, 1);
  ctx.bezierCurveTo(14, 6, -14, 6, -24, 1);
  ctx.closePath();
  ctx.fill();

  ctx.fillStyle = centerTone;
  ctx.beginPath();
  ctx.ellipse(0, -3, 10, 3.2, 0, 0, Math.PI * 2);
  ctx.fill();

  ctx.restore();
  return;
}

  if (item.material === 'Koordinationsleiter') {
    const colorMap = {
      Rot: '#C00000',
      Gelb: '#FFDC00'
    };

    const fill = colorMap[item.value] || '#FFAD00';

    ctx.save();
    applyTransform();
    applySelectionStyle();

    ctx.strokeStyle = '#111827';
    ctx.lineWidth = 3;
    ctx.fillStyle = fill;

    ctx.beginPath();
    ctx.roundRect(-14, -34, 6, 68, 3);
    ctx.roundRect(8, -34, 6, 68, 3);
    ctx.fill();
    ctx.stroke();

    for (let i = -26; i <= 26; i += 13) {
      ctx.beginPath();
      ctx.roundRect(-10, i, 20, 4, 2);
      ctx.fill();
      ctx.stroke();
    }

    ctx.restore();
    return;
  }

  ctx.save();
  applyTransform();
  applySelectionStyle();

  ctx.font = '12px sans-serif';
  ctx.fillStyle = 'rgba(255,255,255,0.92)';
  ctx.strokeStyle = '#0f172a';
  ctx.lineWidth = 2;

  ctx.beginPath();
  ctx.roundRect(-34, -16, 68, 32, 8);
  ctx.fill();
  ctx.stroke();

  ctx.fillStyle = '#0f172a';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(item.material || item.value || 'Objekt', 0, 0);

  ctx.restore();
};
  const drawPlacedItems = (drawWidth, drawHeight) => {
  ctx.save();
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';

  placed.forEach((item) => {
    const x = item.xRatio * drawWidth;
    const y = item.yRatio * drawHeight;

    if (item.icon) {
      const fontSize = Math.max(22, Math.min(34, Math.round(drawWidth / 18)));
      ctx.font = `${fontSize}px sans-serif`;
      ctx.fillText(item.icon, x, y);
      return;
    }

    drawCanvasMaterialItem(item, x, y);
  });

  ctx.restore();
};

  const draw = () => {
    if (section && !section.open) return;
    const { drawWidth, drawHeight } = resizeCanvas();
    drawPitch(drawWidth, drawHeight);
    drawPlacedItems(drawWidth, drawHeight);
  };

  document.querySelectorAll('.draggable').forEach((btn) => {
    btn.addEventListener('click', () => {
      selected = btn.dataset.icon;
      document
        .querySelectorAll('.draggable')
        .forEach((b) => b.classList.remove('ring-2', 'ring-emerald-500'));
      btn.classList.add('ring-2', 'ring-emerald-500');
    });
  });
canvas.addEventListener('pointerdown', (ev) => {
  const hitItem = getPlacedItemAtPoint(ev.clientX, ev.clientY);

  selectedPlacedItemId = hitItem ? hitItem.id : null;
  updateTacticsEditPanel();
  draw();
});
 const getScaleStep = (event) => (event.shiftKey ? 0.1 : 0.05);
const getRotationStep = (event) => (event.shiftKey ? 15 : 5);

el('tacticsScaleDownBtn')?.addEventListener('click', (event) => {
  const selectedItem = getSelectedPlacedItem();
  if (!selectedItem) return;

  const step = getScaleStep(event);
  selectedItem.scale = Math.max(0.4, Number(((selectedItem.scale ?? 1) - step).toFixed(2)));
  updateTacticsEditPanel();
  draw();
});

el('tacticsScaleUpBtn')?.addEventListener('click', (event) => {
  const selectedItem = getSelectedPlacedItem();
  if (!selectedItem) return;

  const step = getScaleStep(event);
  selectedItem.scale = Math.min(2.5, Number(((selectedItem.scale ?? 1) + step).toFixed(2)));
  updateTacticsEditPanel();
  draw();
});

el('tacticsRotateLeftBtn')?.addEventListener('click', (event) => {
  const selectedItem = getSelectedPlacedItem();
  if (!selectedItem) return;

  const step = getRotationStep(event);
  selectedItem.rotation = (selectedItem.rotation ?? 0) - step;
  updateTacticsEditPanel();
  draw();
});

el('tacticsRotateRightBtn')?.addEventListener('click', (event) => {
  const selectedItem = getSelectedPlacedItem();
  if (!selectedItem) return;

  const step = getRotationStep(event);
  selectedItem.rotation = (selectedItem.rotation ?? 0) + step;
  updateTacticsEditPanel();
  draw();
});

el('tacticsDeleteBtn')?.addEventListener('click', () => {
  if (selectedPlacedItemId == null) return;

  const index = placed.findIndex((item) => item.id === selectedPlacedItemId);
  if (index === -1) return;

  placed.splice(index, 1);
  selectedPlacedItemId = null;
  updateTacticsEditPanel();
  draw();
});
el('tacticsRotateRightBtn')?.addEventListener('click', () => {
  const selectedItem = getSelectedPlacedItem();
  if (!selectedItem) return;

  selectedItem.rotation = (selectedItem.rotation ?? 0) + 15;
  updateTacticsEditPanel();
  draw();
});

el('tacticsDeleteBtn')?.addEventListener('click', () => {
  if (selectedPlacedItemId == null) return;

  const index = placed.findIndex((item) => item.id === selectedPlacedItemId);
  if (index === -1) return;

  placed.splice(index, 1);
  selectedPlacedItemId = null;
  updateTacticsEditPanel();
  draw();
});
  section?.addEventListener('toggle', () => {
    if (section.open) requestAnimationFrame(draw);
  });

  window.addEventListener('resize', draw);

  if (window.ResizeObserver) {
    new ResizeObserver(draw).observe(wrap);
  }

  if (!section || section.open) {
    draw();
  }
  updateTacticsEditPanel();
}

async function uploadVideo() {
  const fd = new FormData();
  fd.append('video', el('videoFile').files[0]);
  fd.append('description', el('videoDesc').value);
  await api('/api/videos/upload', { method: 'POST', body: fd });
  await loadVideos();
}
async function addSocial() {
  await api('/api/videos/link', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ url: el('socialUrl').value }) });
  await loadVideos();
}
async function extractInstructions() {
  const data = await api('/api/videos/extract-instructions', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ description: el('videoDesc').value }) });
  el('instructionsOutput').textContent = data.instructions;
}
async function loadVideos() {
  const videos = await api('/api/videos');
  el('videoList').innerHTML = videos.map((v) => (v.kind === 'social' ? `<div class="border rounded p-2 text-sm">${v.provider}: <a class="text-blue-700 underline" href="${v.url}" target="_blank">${v.url}</a></div>` : `<div class="border rounded p-2 text-sm">Upload: <a class="text-blue-700 underline" href="${v.filePath}" target="_blank">${v.filePath}</a><br/>${v.description || ''}</div>`)).join('');
}

function loadTimeOptions() {
  const slots = [];
  for (let h = 8; h <= 18; h++) {
    for (let m = 0; m < 60; m += 15) {
      const val = `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
      slots.push(`<option value="${val}">${val}</option>`);
    }
  }
  const html = `<option value="">Zeit wählen</option>${slots.join('')}`;
  el('eventMeetingTime').innerHTML = html;
  el('eventKickoffTime').innerHTML = html;
  el('seriesMeetingTime').innerHTML = html;
  el('seriesKickoffTime').innerHTML = html;
  el('seriesEndTime').innerHTML = html;
  el('eventDeadlineTime').innerHTML = html;
}

async function bootstrapData() {
  await Promise.all([loadMembers(), loadBranding(), loadEvents(), loadLedger(), loadAgeGroups(), loadMaterials(), loadExercises(), loadVideos()]);
}

const on = (id, event, handler) => el(id)?.addEventListener(event, handler);

on('loginBtn', 'click', login);
on('forgotBtn', 'click', forgotPassword);
on('saveMemberBtn', 'click', saveMember);
on('uploadLogoBtn', 'click', uploadLogo);
on('createEventBtn', 'click', createEvent);
on('deleteEventBtn', 'click', openDeleteEventsModal);
on('createNomBtn', 'click', createNomination);
on('answerNomBtn', 'click', answerNomination);
on('addLedgerBtn', 'click', addLedger);
on('filterExercisesBtn', 'click', loadExercises);
on('materialSelect', 'change', updateMaterialInfo);
on('bibColor', 'change', updateMaterialInfo);
on('dummyColor', 'change', updateMaterialInfo);
on('uploadVideoBtn', 'click', uploadVideo);
on('addSocialBtn', 'click', addSocial);
on('extractBtn', 'click', extractInstructions);
on('eventEmailNotifyBtn', 'click', () => alert('E-Mail-Benachrichtigung wurde vorbereitet.'));
on('eventTitle', 'change', updateTrainingSeriesVisibility);
on('closeCalendarModalBtn', 'click', closeCalendarModal);
on('modalDeleteEventBtn', 'click', deleteEvent);
on('closeDeleteEventsModalBtn', 'click', closeDeleteEventsModal);
on('confirmDeleteSelectedBtn', 'click', deleteSelectedEvents);
on('calendarModal', 'click', (ev) => {
  if (ev.target.id === 'calendarModal') closeCalendarModal();
});
currentUser = getStoredUser();
initDashboardTabs();
renderSessionUi();
initLineupBuilder();
loadTimeOptions();
initCalendarControls();
renderCalendar([]);
updateTrainingSeriesVisibility();
initGooglePlacesForEventFields();
renderTacticsMaterialFields();
initCoachingAreaDragAndDrop();
const formationCatalog = [
  { id: '3-2-1', name: '3-2-1', lines: [['ST'], ['LM', 'RM'], ['LV', 'IV', 'RV'], ['TW']] },
  { id: '2-3-1', name: '2-3-1', lines: [['ST'], ['LM', 'ZM', 'RM'], ['LV', 'RV'], ['TW']] },
  { id: '3-1-2', name: '3-1-2', lines: [['ST', 'ST'], ['ZM'], ['LV', 'IV', 'RV'], ['TW']] },
  { id: '2-2-2', name: '2-2-2', lines: [['ST', 'ST'], ['ZM', 'ZM'], ['LV', 'RV'], ['TW']] },
  { id: '1-3-2', name: '1-3-2', lines: [['ST', 'ST'], ['LM', 'ZM', 'RM'], ['IV'], ['TW']] },

  { id: '3-2-3', name: '3-2-3', lines: [['LF', 'ST', 'RF'], ['DM', 'ZM'], ['LV', 'IV', 'RV'], ['TW']] },
  { id: '4-3-1', name: '4-3-1', lines: [['ST'], ['LM', 'ZM', 'RM'], ['LV', 'IV', 'IV', 'RV'], ['TW']] },
  { id: '3-3-2', name: '3-3-2', lines: [['ST', 'ST'], ['LM', 'ZM', 'RM'], ['LV', 'IV', 'RV'], ['TW']] },
  { id: '3-4-1', name: '3-4-1', lines: [['ST'], ['LM', 'ZM', 'ZM', 'RM'], ['IV', 'IV', 'IV'], ['TW']] },
  { id: '4-1-3', name: '4-1-3', lines: [['ST'], ['LM', 'ZM', 'RM'], ['DM'], ['LV', 'IV', 'IV', 'RV'], ['TW']] },
  { id: '2-4-2', name: '2-4-2', lines: [['ST', 'ST'], ['LM', 'ZM', 'ZM', 'RM'], ['IV', 'IV'], ['TW']] },
  { id: '3-1-3-1', name: '3-1-3-1', lines: [['ST'], ['LM', 'ZM', 'RM'], ['DM'], ['LV', 'IV', 'RV'], ['TW']] },
  { id: '4-2-2', name: '4-2-2', lines: [['ST', 'ST'], ['ZM', 'ZM'], ['LV', 'IV', 'IV', 'RV'], ['TW']] },

  { id: '4-2-3-1', name: '4-2-3-1', lines: [['ST'], ['LM', 'OM', 'RM'], ['DM', 'DM'], ['LV', 'IV', 'IV', 'RV'], ['TW']] },
  { id: '4-3-3', name: '4-3-3', lines: [['LF', 'ST', 'RF'], ['DM', 'ZM', 'ZM'], ['LV', 'IV', 'IV', 'RV'], ['TW']] },
  { id: '3-4-2-1', name: '3-4-2-1', lines: [['ST'], ['OM', 'OM'], ['LM', 'ZM', 'ZM', 'RM'], ['IV', 'IV', 'IV'], ['TW']] },
  { id: '3-5-2', name: '3-5-2', lines: [['ST', 'ST'], ['LM', 'DM', 'ZM', 'ZM', 'RM'], ['IV', 'IV', 'IV'], ['TW']] },
  { id: '4-2-2-2', name: '4-2-2-2', lines: [['ST', 'ST'], ['OM', 'OM'], ['DM', 'DM'], ['LV', 'IV', 'IV', 'RV'], ['TW']] },
  { id: '4-4-2', name: '4-4-2', lines: [['ST', 'ST'], ['LM', 'ZM', 'ZM', 'RM'], ['LV', 'IV', 'IV', 'RV'], ['TW']] },
  { id: '4-1-2-1-2', name: '4-1-2-1-2', lines: [['ST', 'ST'], ['OM'], ['ZM', 'ZM'], ['DM'], ['LV', 'IV', 'IV', 'RV'], ['TW']] },
  { id: '4-1-4-1', name: '4-1-4-1', lines: [['ST'], ['LM', 'ZM', 'ZM', 'RM'], ['DM'], ['LV', 'IV', 'IV', 'RV'], ['TW']] },
  { id: '3-4-3', name: '3-4-3', lines: [['LF', 'ST', 'RF'], ['LM', 'ZM', 'ZM', 'RM'], ['IV', 'IV', 'IV'], ['TW']] },
  { id: '5-3-2', name: '5-3-2', lines: [['ST', 'ST'], ['ZM', 'ZM', 'ZM'], ['LV', 'IV', 'IV', 'IV', 'RV'], ['TW']] },
  { id: '5-4-1', name: '5-4-1', lines: [['ST'], ['LM', 'ZM', 'ZM', 'RM'], ['LV', 'IV', 'IV', 'IV', 'RV'], ['TW']] },
  { id: '4-3-2-1', name: '4-3-2-1', lines: [['ST'], ['OM', 'OM'], ['ZM', 'ZM', 'ZM'], ['LV', 'IV', 'IV', 'RV'], ['TW']] },
  { id: '3-4-1-2', name: '3-4-1-2', lines: [['ST', 'ST'], ['OM'], ['LM', 'ZM', 'ZM', 'RM'], ['IV', 'IV', 'IV'], ['TW']] },
  { id: '3-1-4-2', name: '3-1-4-2', lines: [['ST', 'ST'], ['LM', 'ZM', 'ZM', 'RM'], ['DM'], ['IV', 'IV', 'IV'], ['TW']] },
  { id: '4-2-4', name: '4-2-4', lines: [['LF', 'ST', 'ST', 'RF'], ['ZM', 'ZM'], ['LV', 'IV', 'IV', 'RV'], ['TW']] },
  { id: '5-2-3', name: '5-2-3', lines: [['LF', 'ST', 'RF'], ['ZM', 'ZM'], ['LV', 'IV', 'IV', 'IV', 'RV'], ['TW']] },
  { id: '3-3-3-1', name: '3-3-3-1', lines: [['ST'], ['OM', 'OM', 'OM'], ['DM', 'ZM', 'ZM'], ['IV', 'IV', 'IV'], ['TW']] },
  { id: '3-2-4-1', name: '3-2-4-1', lines: [['ST'], ['ZM', 'ZM', 'OM', 'OM'], ['DM', 'DM'], ['IV', 'IV', 'IV'], ['TW']] },
  { id: '4-5-1', name: '4-5-1', lines: [['ST'], ['LM', 'ZM', 'ZM', 'ZM', 'RM'], ['LV', 'IV', 'IV', 'RV'], ['TW']] },
  { id: '2-3-5', name: '2-3-5', lines: [['LF', 'ZM', 'ST', 'ZM', 'RF'], ['DM', 'DM', 'DM'], ['IV', 'IV'], ['TW']] }
];

let formationIndex = 0;
const getLineYPositions = (lineCount) => {
  if (lineCount === 4) return [0.18, 0.44, 0.72, 0.88];
  if (lineCount === 5) return [0.16, 0.32, 0.50, 0.70, 0.88];
  if (lineCount === 6) return [0.14, 0.26, 0.40, 0.56, 0.72, 0.88];
  return [0.16, 0.32, 0.50, 0.70, 0.88];
};

const getLineXPositions = (labels) => {
  const count = labels.length;

  if (count === 1) return [0.50];

  if (count === 2) {
    if (labels.every((label) => label === 'ST')) return [0.43, 0.57];
    if (labels.every((label) => label === 'IV')) return [0.39, 0.61];
    if (labels.some((label) => ['DM', 'ZM', 'OM'].includes(label))) return [0.42, 0.58];
    return [0.28, 0.72];
  }

  if (count === 3) {
    if (labels.includes('LF') || labels.includes('RF')) return [0.22, 0.50, 0.78];
    if (labels.includes('LV') || labels.includes('RV')) return [0.18, 0.50, 0.82];
    return [0.30, 0.50, 0.70];
  }

  if (count === 4) return [0.18, 0.39, 0.61, 0.82];
  if (count === 5) return [0.12, 0.31, 0.50, 0.69, 0.88];

  return labels.map((_, index) => (index + 1) / (count + 1));
};

const getFormationPositions = (formation) => {
  const yPositions = getLineYPositions(formation.lines.length);

  return formation.lines.flatMap((line, lineIndex) => {
    const xPositions = getLineXPositions(line);

    return line.map((label, playerIndex) => ({
      key: `${formation.id}-${lineIndex}-${playerIndex}`,
      label,
      x: xPositions[playerIndex],
      y: yPositions[lineIndex]
    }));
  });
};
function initFormationModal() {
  const modal = el('formationModal');
  const body = el('formationModalBody');
const currentNameLabel = el('formationModalCurrentName');
const prevFormationBtn = el('prevFormationBtn');
const nextFormationBtn = el('nextFormationBtn');
const pickPlayersFromFormationBtn = el('pickPlayersFromFormationBtn');
const applyFormationModalBtn = el('applyFormationModalBtn');

let playerPickMode = false;
let activePositionKey = null;
let badgeHitAreas = [];

const formationAssignments = new Map();

const getCurrentFormation = () => formationCatalog[formationIndex] || null;

const getCurrentPositions = () => {
  const formation = getCurrentFormation();
  return formation ? getFormationPositions(formation) : [];
};

const getPlayerId = (player) => {
  if (player == null) return '';
  if (typeof player === 'string') return player;

  return String(
    player.id ??
    player.playerId ??
    player.uuid ??
    player.name ??
    `${player.firstName || ''}-${player.lastName || ''}`
  );
};

const getPlayerName = (player) => {
  if (player == null) return '';
  if (typeof player === 'string') return player;

  return (
    player.displayName ||
    player.name ||
    player.fullName ||
    [player.firstName, player.lastName].filter(Boolean).join(' ') ||
    player.nickname ||
    'Unbekannt'
  );
};
  const getPlayerSource = () => {
  if (Array.isArray(lineupState?.players) && lineupState.players.length) {
    return lineupState.players;
  }

  if (Array.isArray(lineupMembersCache) && lineupMembersCache.length) {
    return lineupMembersCache;
  }

  if (typeof players !== 'undefined' && Array.isArray(players) && players.length) {
    return players;
  }

  return [];
};
  const getAssignedPlayer = (positionKey) => formationAssignments.get(positionKey) || null;

const closePlayerPicker = () => {
  activePositionKey = null;
};

const openPlayerPickerForPosition = (positionKey) => {
  activePositionKey = positionKey;
lineupState.selectedSlotId = positionKey;
};

const getCanvasPoint = (canvas, clientX, clientY) => {
  const rect = canvas.getBoundingClientRect();

  return {
    x: clientX - rect.left,
    y: clientY - rect.top
  };
};

const getHitBadge = (x, y) => {
  for (const area of badgeHitAreas) {
    const dx = x - area.x;
    const dy = y - area.y;
    const distance = Math.sqrt(dx * dx + dy * dy);

    if (distance <= area.radius) {
      return area;
    }
  }

  return null;
};
  const getUsedPlayerIds = (excludePositionKey = null) => {
  const usedIds = new Set();

  for (const [positionKey, player] of formationAssignments.entries()) {
    if (!player || positionKey === excludePositionKey) continue;
    usedIds.add(getPlayerId(player));
  }

  return usedIds;
};

const getAvailablePlayers = (positionKey = null) => {
  const usedIds = getUsedPlayerIds(positionKey);

  return getPlayerSource().filter((player) => {
    const playerId = getPlayerId(player);
    return !usedIds.has(playerId);
  });
};

const isCurrentFormationComplete = () => {
  const positions = getCurrentPositions();
  if (!positions.length) return false;

  return positions.every((position) => formationAssignments.has(position.key));
};

const updateApplyButtonState = () => {
  if (!applyFormationModalBtn) return;

  const isComplete = isCurrentFormationComplete();

  applyFormationModalBtn.disabled = !isComplete;
  applyFormationModalBtn.classList.toggle('opacity-50', !isComplete);
  applyFormationModalBtn.classList.toggle('cursor-not-allowed', !isComplete);
};
  const renderPlayerPicker = () => {
  const pickerWrap = el('formationPlayerPicker');
  const pickerHint = el('formationPlayerPickerHint');
  const playerSelect = el('formationPlayerSelect');

  if (!pickerWrap || !pickerHint || !playerSelect) return;

  if (!playerPickMode) {
    pickerWrap.classList.add('hidden');
    return;
  }

  pickerWrap.classList.remove('hidden');

  const selectedPositionKey = activePositionKey || lineupState.selectedSlotId || '';

  if (!selectedPositionKey) {
    pickerHint.textContent = 'Position antippen oder anklicken.';
    playerSelect.innerHTML = '<option value="">Bitte zuerst eine Position wählen</option>';
    playerSelect.disabled = true;
    return;
  }

  const positions = getCurrentPositions();
  const activePosition =
    positions.find(
      (position) => String(position.slotId || position.key) === String(selectedPositionKey)
    ) || null;

  const assignedPlayer = getAssignedPlayer(selectedPositionKey);

  const availablePlayers = getAvailablePlayers(selectedPositionKey);

  pickerHint.textContent = activePosition
    ? `Spieler für ${activePosition.label} auswählen (${availablePlayers.length} Spieler)`
    : `Spieler auswählen (${availablePlayers.length} Spieler)`;

  const options = [
    '<option value="">— Spieler wählen —</option>',
    assignedPlayer ? '<option value="__clear__">Zuweisung entfernen</option>' : '',
    ...availablePlayers.map((player) => {
      const playerId = String(getPlayerId(player) ?? '');
      const playerName = getPlayerName(player) || 'Unbekannter Spieler';
      const isSelected =
        assignedPlayer &&
        String(getPlayerId(assignedPlayer) ?? '') === playerId
          ? 'selected'
          : '';

      return `<option value="${playerId.replace(/"/g, '&quot;')}" ${isSelected}>${playerName}</option>`;
    }),
  ];

  playerSelect.innerHTML = options.join('');
  playerSelect.disabled = false;

  if (assignedPlayer) {
    playerSelect.value = String(getPlayerId(assignedPlayer) ?? '');
  }
};

const assignPlayerToActivePosition = (playerId) => {
  if (!activePositionKey) return;

  if (playerId === '__clear__') {
    formationAssignments.delete(activePositionKey);
    renderFormationPreview();
    return;
  }

  const selectedPlayer = getPlayerSource().find(
  (player) => getPlayerId(player) === playerId
);
  if (!selectedPlayer) return;

  formationAssignments.set(activePositionKey, selectedPlayer);
  renderFormationPreview();
};
function updateFormationLabel() {
  if (!currentNameLabel) return;
  currentNameLabel.textContent = formationCatalog[formationIndex]?.name || '';
}
  const renderFormationPreview = () => {
  if (!body) return;

  body.innerHTML = `
  <div class="flex flex-col gap-3">
    <canvas id="formationPreviewCanvas" style="display:block; width:100%; height:100%; border-radius:14px;"></canvas>

    <div id="formationPlayerPicker" class="hidden rounded-xl border border-white/20 bg-white/95 p-3 text-slate-800 shadow-lg">
      <div id="formationPlayerPickerHint" class="mb-2 text-sm font-medium text-slate-700">
        Position antippen oder anklicken.
      </div>

      <select id="formationPlayerSelect" class="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-800">
        <option value="">— Spieler wählen —</option>
      </select>
    </div>
  </div>
`;

  const canvas = el('formationPreviewCanvas');
  if (!canvas) return;

  const ctx = canvas.getContext('2d');
  if (!ctx) return;
const playerSelect = el('formationPlayerSelect');

playerSelect?.addEventListener('change', (event) => {
  assignPlayerToActivePosition(event.target.value);
});
  const getPitchGreen = () => {
    const selectors = [
      '#createEventBtn',
      '#saveMemberBtn',
      '#saveEventBtn',
      'button.bg-green-600',
      'button.bg-green-500',
      'button.bg-emerald-600',
      'button.bg-emerald-500'
    ];

    for (const selector of selectors) {
      const node = document.querySelector(selector);
      if (!node) continue;
      const color = getComputedStyle(node).backgroundColor;
      if (color && color !== 'rgba(0, 0, 0, 0)' && color !== 'transparent') {
        return color;
      }
    }

    return '#16a34a';
  };

  const drawCornerArc = (x, y, radius, startAngle, endAngle) => {
    ctx.beginPath();
    ctx.arc(x, y, radius, startAngle, endAngle);
    ctx.stroke();
  };

  const drawPenaltyArc = (x, y, radius, penaltyLineY, topSide) => {
    const offset = Math.min(radius, Math.abs(penaltyLineY - y));
    const angle = Math.asin(offset / radius);

    ctx.beginPath();

    if (topSide) {
      ctx.arc(x, y, radius, angle, Math.PI - angle);
    } else {
      ctx.arc(x, y, radius, Math.PI + angle, Math.PI * 2 - angle);
    }

    ctx.stroke();
  };

  const drawEnd = (isTop, fieldX, fieldY, fieldWidth, fieldHeight, scale) => {
    const goalWidth = 7.32;
    const goalDepth = 2.4;
    const goalAreaWidth = 18.32;
    const goalAreaDepth = 5.5;
    const penaltyAreaWidth = 40.32;
    const penaltyAreaDepth = 16.5;
    const penaltySpotDistance = 11;
    const penaltyArcRadius = 9.15;

    const centerX = fieldX + fieldWidth / 2;

    const goalX = centerX - (goalWidth * scale) / 2;
    const goalAreaX = centerX - (goalAreaWidth * scale) / 2;
    const penaltyAreaX = centerX - (penaltyAreaWidth * scale) / 2;

    const goalWidthPx = goalWidth * scale;
    const goalDepthPx = goalDepth * scale;
    const goalAreaWidthPx = goalAreaWidth * scale;
    const goalAreaDepthPx = goalAreaDepth * scale;
    const penaltyAreaWidthPx = penaltyAreaWidth * scale;
    const penaltyAreaDepthPx = penaltyAreaDepth * scale;
    const spotRadius = Math.max(3, scale * 0.22);

    if (isTop) {
      ctx.strokeRect(goalAreaX, fieldY, goalAreaWidthPx, goalAreaDepthPx);
      ctx.strokeRect(penaltyAreaX, fieldY, penaltyAreaWidthPx, penaltyAreaDepthPx);
      ctx.strokeRect(goalX, fieldY - goalDepthPx, goalWidthPx, goalDepthPx);

      const spotY = fieldY + penaltySpotDistance * scale;

      ctx.beginPath();
      ctx.arc(centerX, spotY, spotRadius, 0, Math.PI * 2);
      ctx.fill();

      drawPenaltyArc(centerX, spotY, penaltyArcRadius * scale, fieldY + penaltyAreaDepthPx, true);
      return;
    }

    const goalAreaY = fieldY + fieldHeight - goalAreaDepthPx;
    const penaltyAreaY = fieldY + fieldHeight - penaltyAreaDepthPx;
    const goalY = fieldY + fieldHeight;

    ctx.strokeRect(goalAreaX, goalAreaY, goalAreaWidthPx, goalAreaDepthPx);
    ctx.strokeRect(penaltyAreaX, penaltyAreaY, penaltyAreaWidthPx, penaltyAreaDepthPx);
    ctx.strokeRect(goalX, goalY, goalWidthPx, goalDepthPx);

    const spotY = fieldY + fieldHeight - penaltySpotDistance * scale;

    ctx.beginPath();
    ctx.arc(centerX, spotY, spotRadius, 0, Math.PI * 2);
    ctx.fill();

    drawPenaltyArc(centerX, spotY, penaltyArcRadius * scale, penaltyAreaY, false);
  };

  const drawBadge = (x, y, label, playerName = null, scale = 1) => {
  const radius = 22 * scale;

  const colors = {
    TW: '#2d8a2d',

    LV: '#1a6fc4',
    RV: '#1a6fc4',
    IV: '#1a6fc4',
    DM: '#1a6fc4',

    ZM: '#d4860f',
    LM: '#d4860f',
    RM: '#d4860f',
    OM: '#d4860f',

    ST: '#e8350a',
    LF: '#e8350a',
    RF: '#e8350a',
    LA: '#e8350a',
    RA: '#e8350a'
  };

  ctx.save();

  // Badge-Kreis
  ctx.fillStyle = colors[label] || '#1e293b';
  ctx.beginPath();
  ctx.arc(x, y, radius, 0, Math.PI * 2);
  ctx.fill();

  ctx.strokeStyle = '#ffffff';
  ctx.lineWidth = 3.5 * scale;
  ctx.stroke();

  // Position IM Kreis
  ctx.fillStyle = '#ffffff';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  const labelSize = Math.round(13 * scale);
  ctx.font = `700 ${labelSize}px Arial, sans-serif`;
  ctx.fillText(label, x, y + 1);

  // Spielername UNTER dem Kreis
  if (playerName) {
    const shortName = playerName.length > 12 ? playerName.slice(0, 11) + '…' : playerName;
    const nameSize = Math.round(13 * scale);

    ctx.font = `700 ${nameSize}px Arial, sans-serif`;
    ctx.fillStyle = 'rgba(0,0,0,0.8)';
    ctx.fillText(shortName, x + 1, y + radius + nameSize + 2);

    ctx.fillStyle = '#ffffff';
    ctx.fillText(shortName, x, y + radius + nameSize + 1);
  }

  ctx.restore();
};

  const draw = () => {
  const dpr = window.devicePixelRatio || 1;
  const drawWidth  = Math.max(320, body.clientWidth  || 760);
  const drawHeight = Math.max(360, body.clientHeight || 560);
  canvas.style.width  = `${drawWidth}px`;
  canvas.style.height = `${drawHeight}px`;
  canvas.width  = Math.round(drawWidth  * dpr);
  canvas.height = Math.round(drawHeight * dpr);
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.clearRect(0, 0, drawWidth, drawHeight);

  const padding = 0;
const halfPitchRatio = 68 / 52.5;
let fieldWidth = drawWidth;
let fieldHeight = fieldWidth / halfPitchRatio;

if (fieldHeight > drawHeight) {
  fieldHeight = drawHeight;
  fieldWidth = fieldHeight * halfPitchRatio;
}

const fieldX = (drawWidth - fieldWidth) / 2;
const fieldY = (drawHeight - fieldHeight) / 2;
const scale = fieldWidth / 68;
const centerX = fieldX + fieldWidth / 2;
const halfLineY = fieldY;
const goalLineY = fieldY + fieldHeight;

  ctx.fillStyle = '#047857';
ctx.fillRect(0, 0, drawWidth, drawHeight);

  ctx.strokeStyle = 'rgba(255,255,255,0.96)';
  ctx.fillStyle   = 'rgba(255,255,255,0.96)';
  ctx.lineWidth   = 2.5;
  ctx.lineCap     = 'round';
  ctx.lineJoin    = 'round';

  ctx.strokeRect(fieldX, fieldY, fieldWidth, fieldHeight);

  ctx.beginPath();
  ctx.moveTo(fieldX, halfLineY);
  ctx.lineTo(fieldX + fieldWidth, halfLineY);
  ctx.stroke();

  ctx.beginPath();
  ctx.arc(centerX, halfLineY, 9.15 * scale, 0, Math.PI);
  ctx.stroke();

  ctx.beginPath();
  ctx.arc(centerX, halfLineY, Math.max(3, scale * 0.22), 0, Math.PI * 2);
  ctx.fill();

  const goalWidth        =  7.32 * scale;
  const goalDepth        =  2.4  * scale;
  const goalAreaWidth    = 18.32 * scale;
  const goalAreaDepth    =  5.5  * scale;
  const penaltyAreaWidth = 40.32 * scale;
  const penaltyAreaDepth = 16.5  * scale;

  ctx.strokeRect(centerX - goalWidth / 2,        goalLineY,             goalWidth,        goalDepth);
  ctx.strokeRect(centerX - goalAreaWidth / 2,    goalLineY - goalAreaDepth,    goalAreaWidth,    goalAreaDepth);
  ctx.strokeRect(centerX - penaltyAreaWidth / 2, goalLineY - penaltyAreaDepth, penaltyAreaWidth, penaltyAreaDepth);

  const spotY = goalLineY - 11 * scale;
  ctx.beginPath();
  ctx.arc(centerX, spotY, Math.max(3, scale * 0.22), 0, Math.PI * 2);
  ctx.fill();

  const penaltyArcRadius = 9.15 * scale;
  const penaltyLineY     = goalLineY - penaltyAreaDepth;
  const offset = Math.abs(penaltyLineY - spotY);
  if (offset < penaltyArcRadius) {
    const angle = Math.acos(offset / penaltyArcRadius);
    ctx.beginPath();
    ctx.arc(centerX, spotY, penaltyArcRadius, Math.PI + angle, Math.PI * 2 - angle);
    ctx.stroke();
  }

  const cornerRadius = Math.max(8, scale);
  drawCornerArc(fieldX,              goalLineY, cornerRadius, -Math.PI / 2, 0);
  drawCornerArc(fieldX + fieldWidth, goalLineY, cornerRadius,  Math.PI,     Math.PI * 1.5);

  const currentFormation = formationCatalog[formationIndex];
const positions = getFormationPositions(currentFormation);

badgeHitAreas = [];

for (const position of positions) {
  const badgeX = fieldX + fieldWidth * position.x;
  const badgeY = fieldY + fieldHeight * position.y;

  const assignedPlayer = getAssignedPlayer(position.slotId || position.key);
  drawBadge(
    badgeX,
    badgeY,
    position.label,
    assignedPlayer ? getPlayerName(assignedPlayer) : null
  );

  badgeHitAreas.push({
    key: position.slotId || position.key,
    label: position.label,
    x: badgeX,
    y: badgeY,
    radius: 28
  });
}
    renderPlayerPicker();
updateApplyButtonState();
};
draw();
    canvas.addEventListener('click', (event) => {
  if (!playerPickMode) return;

  const point = getCanvasPoint(canvas, event.clientX, event.clientY);
  const hitBadge = getHitBadge(point.x, point.y);

  if (!hitBadge) return;

  activePositionKey = hitBadge.key;
lineupState.selectedSlotId = hitBadge.key;

if (lineupState.selectedPlayerId) {
  assignPlayerToActivePosition(lineupState.selectedPlayerId);
  lineupState.selectedPlayerId = null;
} else {
  openPlayerPickerForPosition(hitBadge.key);
}

renderFormationPreview();
});
};
  const changeFormation = (step) => {
  if (!formationCatalog.length) return;

  formationIndex = (formationIndex + step + formationCatalog.length) % formationCatalog.length;
  updateFormationLabel();
  renderFormationPreview();
};

prevFormationBtn?.addEventListener('click', () => changeFormation(-1));
nextFormationBtn?.addEventListener('click', () => changeFormation(1));
pickPlayersFromFormationBtn?.addEventListener('click', () => {
  playerPickMode = !playerPickMode;

  if (!playerPickMode) {
    closePlayerPicker();
  }

  pickPlayersFromFormationBtn.textContent = playerPickMode
    ? 'Auswahl beenden'
    : 'Spieler auswählen';

  renderFormationPreview();
});
const openModal = () => {
  modal?.classList.remove('hidden');
  modal?.classList.add('flex');
  requestAnimationFrame(() => {
    renderFormationPreview();
  });
  refreshLineupBuilderData()
    .then(() => {
      renderFormationPreview();
    })
    .catch((err) => {
      console.warn('Spieler konnten nicht geladen werden:', err);
    });
};

  const closeModal = () => {
    modal?.classList.add('hidden');
    modal?.classList.remove('flex');
  };

  el('openFormationModalBtn')?.addEventListener('click', openModal);
  el('closeFormationModalBtn')?.addEventListener('click', closeModal);
  el('cancelFormationModalBtn')?.addEventListener('click', closeModal);

  modal?.addEventListener('click', (event) => {
    if (event.target === modal) closeModal();
  });
}

window.addEventListener('load', () => {
  setTimeout(() => {
    setupCanvas();
    setupLineupCanvas();
    initFormationModal();
  }, 100);
});
if (token && currentUser) {
  bootstrapData().catch(() => {
    setAuthInfo('Session gefunden – bitte neu einloggen.');
  });
} else if (token) {
  setAuthInfo('Session gefunden – bitte neu einloggen.');
}
