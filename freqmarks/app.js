import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm';
import { APP_CONFIG } from './config.js';

const DEFAULT_COLOR = normalizeHex(APP_CONFIG.defaultColor) || '#D32F2F';
const SESSION_KEY = 'fpv-table-access-session';
const ADMIN_HEADER_NAME = 'x-freqmarks-access-key';
const APP_TITLE = String(APP_CONFIG.appTitle || 'Частотные отметки').trim() || 'Частотные отметки';
const BOARD_STATUS_OPTIONS = [
  { value: 'ready', label: 'Готов' },
  { value: 'destroyed', label: 'Уничтожен' },
  { value: 'lost', label: 'Утерян' },
];
const BOARD_STATUS_LABELS = Object.fromEntries(BOARD_STATUS_OPTIONS.map((item) => [item.value, item.label]));
const DEFAULT_BOARD_STATUS = BOARD_STATUS_OPTIONS[0].value;

const DEFAULT_BANDS = [
  { key: 'A', label: 'Band - A', channels: [5865, 5845, 5825, 5805, 5785, 5765, 5745, 5725] },
  { key: 'B', label: 'Band - B', channels: [5733, 5752, 5771, 5790, 5809, 5828, 5847, 5866] },
  { key: 'E', label: 'Band - E', channels: [5705, 5685, 5665, 5645, 5885, 5905, 5925, 5945] },
  { key: 'F', label: 'Band - F', channels: [5740, 5760, 5780, 5800, 5820, 5840, 5860, 5880] },
  { key: 'R', label: 'Band - R', channels: [5658, 5695, 5732, 5769, 5806, 5843, 5880, 5917] },
  { key: 'D', label: 'Band - D', channels: [5362, 5399, 5436, 5473, 5510, 5547, 5584, 5621] },
  { key: 'U', label: 'Band - U', channels: [5325, 5348, 5366, 5384, 5402, 5420, 5438, 5456] },
  { key: 'O', label: 'Band - O', channels: [5474, 5492, 5510, 5528, 5546, 5564, 5582, 5600] },
  { key: 'L', label: 'Band - L', channels: [5333, 5373, 5413, 5453, 5493, 5533, 5573, 5613] },
  { key: 'H', label: 'Band - H', channels: [5653, 5693, 5733, 5773, 5813, 5853, 5893, 5933] },
  { key: 'X', label: 'Band - X', channels: [4990, 5020, 5050, 5080, 5110, 5140, 5170, 5200] },
];

const state = {
  supabase: null,
  accessRole: '',
  adminSupabase: null,
  selectedColor: DEFAULT_COLOR,
  marks: {},
  legend: {},
  legendModels: {},
  bands: cloneBands(DEFAULT_BANDS),
  settings: {
    minFrequencyGap: 100,
  },
  notes: [],
  cellNodes: new Map(),
  channels: [],
  editingFrequencies: false,
  editedBands: null,
  editedMinGap: 100,
  editingNoteId: null,
  noteDraft: null,
};

const refs = {
  setupCard: document.getElementById('setup-card'),
  loginScreen: document.getElementById('login-screen'),
  loginForm: document.getElementById('login-form'),
  loginButton: document.getElementById('login-button'),
  passwordInput: document.getElementById('password-input'),
  loginError: document.getElementById('login-error'),
  accessRoleBadge: document.getElementById('access-role-badge'),
  accessModeText: document.getElementById('access-mode-text'),
  appScreen: document.getElementById('app-screen'),
  controlsGrid: document.getElementById('controls-grid'),
  pageTitle: document.getElementById('page-title'),
  appTitle: document.getElementById('app-title'),
  footerTitle: document.getElementById('footer-title'),
  syncStatus: document.getElementById('sync-status'),
  colorPicker: document.getElementById('color-picker'),
  colorHex: document.getElementById('color-hex'),
  currentColorPreview: document.getElementById('current-color-preview'),
  legendText: document.getElementById('legend-text'),
  addLegendButton: document.getElementById('add-legend-button'),
  exportExcelButton: document.getElementById('export-excel-button'),
  resetButton: document.getElementById('reset-button'),
  logoutButton: document.getElementById('logout-button'),
  clearLegendButton: document.getElementById('clear-legend-button'),
  legendList: document.getElementById('legend-list'),
  legendEmpty: document.getElementById('legend-empty'),
  actionMessage: document.getElementById('action-message'),
  tableHead: document.getElementById('table-head'),
  tableBody: document.getElementById('table-body'),
  mobileBandList: document.getElementById('mobile-band-list'),
  minGapInput: document.getElementById('min-gap-input'),
  frequencyToolbar: document.getElementById('frequency-toolbar'),
  editFrequenciesButton: document.getElementById('edit-frequencies-button'),
  saveFrequenciesButton: document.getElementById('save-frequencies-button'),
  cancelFrequenciesButton: document.getElementById('cancel-frequencies-button'),
  frequencyEditor: document.getElementById('frequency-editor'),
  frequencyBandEditor: document.getElementById('frequency-band-editor'),
  frequencySummary: document.getElementById('frequency-summary'),
  noteTitleInput: document.getElementById('note-title-input'),
  noteTextInput: document.getElementById('note-text-input'),
  addNoteButton: document.getElementById('add-note-button'),
  notesForm: document.getElementById('notes-form'),
  notesList: document.getElementById('notes-list'),
  notesEmpty: document.getElementById('notes-empty'),
};

document.addEventListener('DOMContentLoaded', init);

function createSupabaseClient(headers = {}) {
  return createClient(APP_CONFIG.supabaseUrl, APP_CONFIG.supabaseAnonKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
    },
    global: {
      headers,
    },
  });
}

function readAccessSession() {
  try {
    return JSON.parse(sessionStorage.getItem(SESSION_KEY) || 'null');
  } catch {
    return null;
  }
}

function saveAccessSession(accessKey, role) {
  sessionStorage.setItem(SESSION_KEY, JSON.stringify({ accessKey, role }));
}

function clearAccessSession() {
  sessionStorage.removeItem(SESSION_KEY);
  state.accessRole = '';
  state.adminSupabase = null;
  applyAccessMode();
}

function getAccessRoleMeta(role) {
  if (role === 'admin') {
    return {
      badge: 'Администратор',
      description: 'Режим администратора: можно менять отметки, легенду, частоты и заметки.',
    };
  }

  if (role === 'viewer') {
    return {
      badge: 'Пользователь',
      description: 'Режим просмотра: доступны только информационные блоки, недоступные формы скрыты автоматически.',
    };
  }

  return {
    badge: 'Гость',
    description: 'Введите ключ пользователя или администратора, чтобы открыть страницу.',
  };
}

function isAdmin() {
  return state.accessRole === 'admin';
}

function applyAccessMode() {
  const role = state.accessRole || 'guest';
  const meta = getAccessRoleMeta(state.accessRole);
  document.body.dataset.role = role;

  if (refs.accessRoleBadge) refs.accessRoleBadge.textContent = meta.badge;
  if (refs.accessModeText) refs.accessModeText.textContent = meta.description;

  const admin = isAdmin();
  if (refs.colorPicker) refs.colorPicker.disabled = !admin;
  if (refs.colorHex) refs.colorHex.disabled = !admin;
  if (refs.legendText) refs.legendText.disabled = !admin;
  if (refs.addLegendButton) refs.addLegendButton.disabled = !admin;
  if (refs.resetButton) refs.resetButton.hidden = !admin;
  if (refs.clearLegendButton) refs.clearLegendButton.hidden = !admin;
  if (refs.editFrequenciesButton) refs.editFrequenciesButton.hidden = !admin || state.editingFrequencies;
  if (refs.saveFrequenciesButton) refs.saveFrequenciesButton.hidden = !admin || !state.editingFrequencies;
  if (refs.cancelFrequenciesButton) refs.cancelFrequenciesButton.hidden = !state.editingFrequencies;
  if (refs.minGapInput) refs.minGapInput.disabled = !admin || !state.editingFrequencies;
  if (refs.noteTitleInput) refs.noteTitleInput.disabled = !admin;
  if (refs.noteTextInput) refs.noteTextInput.disabled = !admin;
  if (refs.addNoteButton) refs.addNoteButton.disabled = !admin;
  if (refs.controlsGrid) refs.controlsGrid.hidden = !admin;
  if (refs.frequencyToolbar) refs.frequencyToolbar.hidden = !admin;
  if (refs.notesForm) refs.notesForm.hidden = !admin;
}

async function resolveAccessRole(accessKey) {
  const { data, error } = await state.supabase.rpc('check_access_key', { attempt_key: accessKey });
  if (error) throw error;

  const role = String(data || '').trim().toLowerCase();
  return role === 'admin' || role === 'viewer' ? role : '';
}

function applyAccessSession(accessKey, role, { persist = true } = {}) {
  state.accessRole = role;
  state.adminSupabase = role === 'admin'
    ? createSupabaseClient({ [ADMIN_HEADER_NAME]: accessKey })
    : null;

  if (role !== 'admin') {
    state.editingFrequencies = false;
    state.editedBands = null;
    state.editingNoteId = null;
    state.noteDraft = null;
  }

  if (persist) saveAccessSession(accessKey, role);
  applyAccessMode();
}

function requireAdminAccess() {
  if (isAdmin() && state.adminSupabase) return true;
  showMessage('Режим пользователя: редактирование доступно только по ключу администратора.', 'error');
  return false;
}

function setVisibility(element, isVisible) {
  if (!element) return;
  element.hidden = !isVisible;
  element.setAttribute('aria-hidden', String(!isVisible));
  element.style.display = isVisible ? '' : 'none';
}

function setScreen(screen) {
  document.body.dataset.screen = screen;
  setVisibility(refs.setupCard, screen === 'setup');
  setVisibility(refs.loginScreen, screen === 'login');
  setVisibility(refs.appScreen, screen === 'app');

  if (screen === 'login') {
    window.requestAnimationFrame(() => refs.passwordInput?.focus());
  }

  if (screen === 'app') {
    hideLoginError();
    refs.loginForm?.reset();
    refs.passwordInput?.blur();
    window.scrollTo({ top: 0, behavior: 'auto' });
  }
}

function applyAppTitle() {
  document.title = APP_TITLE;

  [refs.pageTitle, refs.appTitle, refs.footerTitle].forEach((node) => {
    if (node) node.textContent = APP_TITLE;
  });

  document.querySelectorAll('[data-app-title]').forEach((node) => {
    node.textContent = APP_TITLE;
  });
}

async function init() {
  applyAppTitle();
  rebuildFrequencyViews();
  bindEvents();
  setSelectedColor(state.selectedColor);
  renderFrequencyEditor();
  renderNotes();
  applyAccessMode();

  if (!isConfigured()) {
    showSetup();
    return;
  }

  state.supabase = createSupabaseClient();

  showLogin();
  setSyncStatus('Проверка настроек...', 'loading');

  const savedSession = readAccessSession();

  if (savedSession?.accessKey) {
    try {
      const role = await resolveAccessRole(savedSession.accessKey);
      if (role) {
        applyAccessSession(savedSession.accessKey, role, { persist: false });
        await enterApp();
        return;
      }
      clearAccessSession();
    } catch (error) {
      console.error(error);
      showSetup('Не удалось проверить ключ доступа. Проверьте config.js и выполните обновлённый supabase-schema.sql.');
      return;
    }
  }

  setSyncStatus('Ожидание входа', 'loading');
}

function isConfigured() {
  const { supabaseUrl = '', supabaseAnonKey = '' } = APP_CONFIG || {};
  return Boolean(
    supabaseUrl &&
    supabaseAnonKey &&
    !supabaseUrl.includes('YOUR_PROJECT') &&
    !supabaseAnonKey.includes('YOUR_SUPABASE_ANON_KEY')
  );
}

function showSetup(message) {
  setScreen('setup');

  const existingMessage = refs.setupCard.querySelector('[data-setup-error]');
  if (!message) {
    existingMessage?.remove();
    return;
  }

  if (existingMessage) {
    existingMessage.textContent = message;
    return;
  }

  const note = document.createElement('p');
  note.className = 'inline-message error';
  note.dataset.setupError = 'true';
  note.textContent = message;
  refs.setupCard.append(note);
}

function showLogin() {
  setScreen('login');
}

function showApp() {
  setScreen('app');
}

function bindEvents() {
  refs.loginForm.addEventListener('submit', handleLogin);
  refs.colorPicker.addEventListener('input', (event) => setSelectedColor(event.target.value));
  refs.colorHex.addEventListener('change', () => setSelectedColor(refs.colorHex.value));
  refs.colorHex.addEventListener('keydown', (event) => {
    if (event.key === 'Enter') {
      event.preventDefault();
      setSelectedColor(refs.colorHex.value);
    }
  });

  refs.addLegendButton.addEventListener('click', saveLegendFromForm);
  refs.legendText.addEventListener('keydown', (event) => {
    if (event.key === 'Enter') {
      event.preventDefault();
      saveLegendFromForm();
    }
  });

  refs.editFrequenciesButton.addEventListener('click', startFrequencyEditing);
  refs.cancelFrequenciesButton.addEventListener('click', cancelFrequencyEditing);
  refs.saveFrequenciesButton.addEventListener('click', saveFrequencies);
  refs.minGapInput.addEventListener('input', () => {
    if (!state.editingFrequencies) return;
    state.editedMinGap = refs.minGapInput.value;
  });

  refs.addNoteButton.addEventListener('click', saveNoteFromForm);
  refs.exportExcelButton?.addEventListener('click', exportAllDataToExcel);

  refs.resetButton.addEventListener('click', async () => {
    const ok = window.confirm('Удалить все отметки у ячеек?');
    if (!ok) return;
    await clearAllMarks();
  });

  refs.clearLegendButton.addEventListener('click', async () => {
    const ok = window.confirm('Удалить все подписи цветов?');
    if (!ok) return;
    await clearLegend();
  });

  refs.logoutButton.addEventListener('click', () => {
    clearAccessSession();
    unsubscribeRealtime();
    state.marks = {};
    state.legend = {};
    state.legendModels = {};
    state.notes = [];
    state.editingFrequencies = false;
    state.editingNoteId = null;
    state.noteDraft = null;
    applyAccessMode();
    renderAll();
    showLogin();
    setSyncStatus('Ожидание входа', 'loading');
  });

  window.addEventListener('beforeunload', unsubscribeRealtime);
}

function buildTable() {
  refs.tableHead.innerHTML = '';
  refs.tableBody.innerHTML = '';

  const firstBand = state.bands[0];
  if (!firstBand) return;

  const headRow = document.createElement('tr');
  headRow.innerHTML = '<th>Band</th>' + firstBand.channels.map((_, index) => `<th>CH ${index + 1}</th>`).join('');
  refs.tableHead.append(headRow);

  state.bands.forEach((band) => {
    const row = document.createElement('tr');
    const titleCell = document.createElement('th');
    titleCell.scope = 'row';
    titleCell.textContent = band.label;
    row.append(titleCell);

    band.channels.forEach((frequency, index) => {
      const cellId = `${band.key}-${index + 1}`;
      const cell = document.createElement('td');
      cell.className = 'toggle-cell';
      cell.dataset.cellId = cellId;
      cell.dataset.frequency = String(frequency);
      cell.textContent = String(frequency);
      cell.addEventListener('click', () => toggleCell(cellId));
      registerCellNode(cellId, cell);
      row.append(cell);
    });

    refs.tableBody.append(row);
  });
}

function buildMobileCards() {
  refs.mobileBandList.innerHTML = '';

  state.bands.forEach((band) => {
    const card = document.createElement('article');
    card.className = 'mobile-band-card';

    const header = document.createElement('div');
    header.className = 'mobile-band-header';
    header.innerHTML = `
      <div>
        <h3>${band.label}</h3>
        <p class="muted small">Нажимайте только на числовые кнопки</p>
      </div>
      <span class="pill subtle">${band.channels.length} каналов</span>
    `;

    const grid = document.createElement('div');
    grid.className = 'mobile-channel-grid';

    band.channels.forEach((frequency, index) => {
      const cellId = `${band.key}-${index + 1}`;
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'mobile-cell';
      button.dataset.cellId = cellId;
      button.dataset.frequency = String(frequency);
      button.innerHTML = `
        <small>CH ${index + 1}</small>
        <span class="cell-frequency">${frequency}</span>
      `;
      button.addEventListener('click', () => toggleCell(cellId));
      registerCellNode(cellId, button);
      grid.append(button);
    });

    card.append(header, grid);
    refs.mobileBandList.append(card);
  });
}

function rebuildFrequencyViews() {
  state.cellNodes = new Map();
  buildTable();
  buildMobileCards();
  renderMarks();
}

function registerCellNode(cellId, node) {
  const current = state.cellNodes.get(cellId) || [];
  current.push(node);
  state.cellNodes.set(cellId, current);
}

function cloneBands(bands) {
  return (bands || []).map((band) => ({
    key: band.key,
    label: band.label,
    channels: [...band.channels],
  }));
}

function normalizeHex(value) {
  const prepared = String(value || '').trim().toUpperCase();
  const full = /^#[0-9A-F]{6}$/;
  const short = /^#[0-9A-F]{3}$/;

  if (full.test(prepared)) return prepared;
  if (short.test(prepared)) {
    return `#${prepared[1]}${prepared[1]}${prepared[2]}${prepared[2]}${prepared[3]}${prepared[3]}`;
  }
  return null;
}

function getReadableTextColor(hex) {
  const normalized = normalizeHex(hex) || DEFAULT_COLOR;
  const r = Number.parseInt(normalized.slice(1, 3), 16);
  const g = Number.parseInt(normalized.slice(3, 5), 16);
  const b = Number.parseInt(normalized.slice(5, 7), 16);
  const brightness = (r * 299 + g * 587 + b * 114) / 1000;
  return brightness > 160 ? '#111111' : '#FFFFFF';
}

function setSelectedColor(color) {
  const normalized = normalizeHex(color) || DEFAULT_COLOR;
  state.selectedColor = normalized;
  refs.colorPicker.value = normalized;
  refs.colorHex.value = normalized;
  refs.currentColorPreview.style.backgroundColor = normalized;
  refs.addLegendButton.style.backgroundColor = normalized;
  refs.addLegendButton.style.color = getReadableTextColor(normalized);

  const legendLabel = state.legend[normalized];
  refs.legendText.placeholder = legendLabel
    ? `Текущая подпись: ${legendLabel}`
    : 'Например: Мой канал / Свободно / Занято';
}

async function sha256(text) {
  const bytes = new TextEncoder().encode(text);
  const digest = await crypto.subtle.digest('SHA-256', bytes);
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, '0')).join('');
}

async function handleLogin(event) {
  event.preventDefault();
  hideLoginError();

  const accessKey = refs.passwordInput.value.trim();
  if (!accessKey) {
    showLoginError('Введите ключ доступа.');
    return;
  }

  refs.loginButton.disabled = true;
  refs.loginButton.textContent = 'Проверка...';

  try {
    const role = await resolveAccessRole(accessKey);

    if (!role) {
      showLoginError('Неверный ключ доступа.');
      return;
    }

    applyAccessSession(accessKey, role);
    refs.passwordInput.value = '';
    await enterApp();
  } catch (error) {
    console.error(error);
    showLoginError('Не удалось проверить ключ доступа. Проверьте подключение к базе.');
  } finally {
    refs.loginButton.disabled = false;
    refs.loginButton.textContent = 'Открыть страницу';
  }
}

function showLoginError(message) {
  refs.loginError.hidden = false;
  refs.loginError.textContent = message;
}

function hideLoginError() {
  refs.loginError.hidden = true;
  refs.loginError.textContent = '';
}

async function enterApp() {
  showApp();
  applyAppTitle();

  try {
    await Promise.all([loadChannels(), loadSettings(), loadMarks(), loadLegend(), loadLegendModels(), loadNotes()]);
    rebuildFrequencyViews();
    renderAll();
    subscribeRealtime();
    setSyncStatus('Онлайн', 'online');
  } catch (error) {
    console.error(error);
    rebuildFrequencyViews();
    renderAll();
    setSyncStatus('Нет связи', 'offline');
    showMessage('Таблица открыта, но не удалось загрузить данные из базы.', 'error');
  }
}

async function loadChannels() {
  const { data, error } = await state.supabase
    .from('band_channels')
    .select('band_key, channel_number, frequency');

  if (error) throw error;

  const nextBands = cloneBands(DEFAULT_BANDS);
  const bandMap = new Map(nextBands.map((band) => [band.key, band]));

  (data || []).forEach((item) => {
    const band = bandMap.get(String(item.band_key || '').trim());
    const channelIndex = Number(item.channel_number) - 1;
    const frequency = Number(item.frequency);
    if (!band || channelIndex < 0 || channelIndex >= band.channels.length || !Number.isFinite(frequency)) {
      return;
    }
    band.channels[channelIndex] = frequency;
  });

  state.bands = nextBands;
}

async function loadSettings() {
  const { data, error } = await state.supabase
    .from('app_settings')
    .select('min_frequency_gap')
    .eq('id', 1)
    .maybeSingle();

  if (error) throw error;

  const minGap = Number(data?.min_frequency_gap);
  state.settings.minFrequencyGap = Number.isFinite(minGap) && minGap >= 100 ? minGap : 100;
}

async function loadMarks() {
  const { data, error } = await state.supabase
    .from('cell_marks')
    .select('cell_id, color');

  if (error) throw error;

  state.marks = {};
  (data || []).forEach((item) => {
    const color = normalizeHex(item.color);
    if (item.cell_id && color) {
      state.marks[item.cell_id] = color;
    }
  });
}

async function loadLegend() {
  const { data, error } = await state.supabase
    .from('legend_items')
    .select('color, label');

  if (error) throw error;

  state.legend = {};
  (data || []).forEach((item) => {
    const color = normalizeHex(item.color);
    if (color && item.label) {
      state.legend[color] = String(item.label);
    }
  });
}

async function loadLegendModels() {
  const { data, error } = await state.supabase
    .from('legend_models')
    .select('id, color, model_name, model_number, status, sort_order')
    .order('color', { ascending: true })
    .order('sort_order', { ascending: true })
    .order('id', { ascending: true });

  if (error) throw error;

  state.legendModels = {};
  (data || []).forEach((item) => {
    const color = normalizeHex(item.color);
    if (!color) return;

    if (!state.legendModels[color]) {
      state.legendModels[color] = [];
    }

    state.legendModels[color].push(mapLegendModel(item));
  });
}

async function loadNotes() {
  const { data, error } = await state.supabase
    .from('notes')
    .select('id, title, content, created_at, updated_at')
    .order('updated_at', { ascending: false });

  if (error) throw error;

  state.notes = (data || []).map((item) => ({
    id: item.id,
    title: String(item.title || ''),
    content: String(item.content || ''),
    createdAt: item.created_at,
    updatedAt: item.updated_at,
  }));
}

function subscribeRealtime() {
  unsubscribeRealtime();

  const marksChannel = state.supabase
    .channel('fpv-cell-marks')
    .on('postgres_changes', { event: '*', schema: 'public', table: 'cell_marks' }, async () => {
      await loadMarks();
      renderMarks();
    })
    .subscribe(handleRealtimeStatus);

  const legendChannel = state.supabase
    .channel('fpv-legend-items')
    .on('postgres_changes', { event: '*', schema: 'public', table: 'legend_items' }, async () => {
      await loadLegend();
      renderLegend();
      renderMarks();
    })
    .subscribe(handleRealtimeStatus);

  const legendModelsChannel = state.supabase
    .channel('fpv-legend-models')
    .on('postgres_changes', { event: '*', schema: 'public', table: 'legend_models' }, async () => {
      await loadLegendModels();
      renderLegend();
      renderMarks();
    })
    .subscribe(handleRealtimeStatus);

  const frequencyChannel = state.supabase
    .channel('fpv-band-channels')
    .on('postgres_changes', { event: '*', schema: 'public', table: 'band_channels' }, async () => {
      await loadChannels();
      if (!state.editingFrequencies) {
        rebuildFrequencyViews();
      }
      renderFrequencyEditor();
    })
    .subscribe(handleRealtimeStatus);

  const settingsChannel = state.supabase
    .channel('fpv-app-settings')
    .on('postgres_changes', { event: '*', schema: 'public', table: 'app_settings' }, async () => {
      await loadSettings();
      renderFrequencyEditor();
    })
    .subscribe(handleRealtimeStatus);

  const notesChannel = state.supabase
    .channel('fpv-notes')
    .on('postgres_changes', { event: '*', schema: 'public', table: 'notes' }, async () => {
      await loadNotes();
      renderNotes();
    })
    .subscribe(handleRealtimeStatus);

  state.channels = [marksChannel, legendChannel, legendModelsChannel, frequencyChannel, settingsChannel, notesChannel];
}

function unsubscribeRealtime() {
  if (!state.channels.length || !state.supabase) return;

  state.channels.forEach((channel) => {
    state.supabase.removeChannel(channel);
  });

  state.channels = [];
}

function handleRealtimeStatus(status) {
  if (status === 'SUBSCRIBED') {
    setSyncStatus('Онлайн', 'online');
    return;
  }

  if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT' || status === 'CLOSED') {
    setSyncStatus('Нет связи', 'offline');
    return;
  }

  setSyncStatus('Подключение...', 'loading');
}

function setSyncStatus(text, kind) {
  refs.syncStatus.textContent = text;
  refs.syncStatus.classList.remove('offline', 'loading');
  if (kind === 'offline') refs.syncStatus.classList.add('offline');
  if (kind === 'loading') refs.syncStatus.classList.add('loading');
}

async function toggleCell(cellId) {
  if (!requireAdminAccess()) return;

  const currentColor = state.marks[cellId];
  const nextColor = currentColor === state.selectedColor ? '' : state.selectedColor;
  const writeClient = state.adminSupabase;

  try {
    if (nextColor) {
      const { error } = await writeClient
        .from('cell_marks')
        .upsert({ cell_id: cellId, color: nextColor }, { onConflict: 'cell_id' });

      if (error) throw error;
      state.marks[cellId] = nextColor;
      renderMarks();
      showMessage('Отметка сохранена.', 'success');
    } else {
      const { error } = await writeClient
        .from('cell_marks')
        .delete()
        .eq('cell_id', cellId);

      if (error) throw error;
      delete state.marks[cellId];
      renderMarks();
      showMessage('Отметка снята.', 'success');
    }
  } catch (error) {
    console.error(error);
    showMessage('Не удалось обновить ячейку.', 'error');
  }
}

async function saveLegendFromForm() {
  if (!requireAdminAccess()) return;

  const color = normalizeHex(state.selectedColor);
  const label = refs.legendText.value.trim();

  if (!color) {
    showMessage('Некорректный цвет.', 'error');
    return;
  }

  if (!label) {
    showMessage('Введите текст для легенды.', 'error');
    return;
  }

  try {
    const { error } = await state.adminSupabase
      .from('legend_items')
      .upsert({ color, label }, { onConflict: 'color' });

    if (error) throw error;

    state.legend[color] = label;
    refs.legendText.value = '';
    setSelectedColor(color);
    renderLegend();
    renderMarks();
    showMessage('Легенда сохранена.', 'success');
  } catch (error) {
    console.error(error);
    showMessage('Не удалось сохранить легенду.', 'error');
  }
}

async function saveLegend(color, label) {
  if (!requireAdminAccess()) return;

  try {
    const normalizedColor = normalizeHex(color);
    const preparedLabel = String(label || '').trim();

    if (!normalizedColor) {
      showMessage('Некорректный цвет.', 'error');
      return;
    }

    if (!preparedLabel) {
      await deleteLegend(normalizedColor);
      return;
    }

    const { error } = await state.adminSupabase
      .from('legend_items')
      .upsert({ color: normalizedColor, label: preparedLabel }, { onConflict: 'color' });

    if (error) throw error;
    state.legend[normalizedColor] = preparedLabel;
    setSelectedColor(normalizedColor);
    renderLegend();
    renderMarks();
    showMessage('Подпись обновлена.', 'success');
  } catch (error) {
    console.error(error);
    showMessage('Не удалось обновить подпись.', 'error');
  }
}

async function deleteLegend(color) {
  if (!requireAdminAccess()) return;

  try {
    const { error } = await state.adminSupabase
      .from('legend_items')
      .delete()
      .eq('color', color);

    if (error) throw error;
    delete state.legend[color];
    delete state.legendModels[color];
    setSelectedColor(state.selectedColor);
    renderLegend();
    renderMarks();
    showMessage('Подпись удалена.', 'success');
  } catch (error) {
    console.error(error);
    showMessage('Не удалось удалить подпись.', 'error');
  }
}

async function clearLegend() {
  if (!requireAdminAccess()) return;

  try {
    const { error } = await state.adminSupabase
      .from('legend_items')
      .delete()
      .neq('color', '#000000');

    if (error) throw error;
    state.legend = {};
    state.legendModels = {};
    setSelectedColor(state.selectedColor);
    renderLegend();
    renderMarks();
    showMessage('Легенда очищена.', 'success');
  } catch (error) {
    console.error(error);
    showMessage('Не удалось очистить легенду.', 'error');
  }
}

async function clearAllMarks() {
  if (!requireAdminAccess()) return;

  try {
    const { error } = await state.adminSupabase
      .from('cell_marks')
      .delete()
      .neq('cell_id', '__none__');

    if (error) throw error;
    state.marks = {};
    renderMarks();
    showMessage('Все отметки удалены.', 'success');
  } catch (error) {
    console.error(error);
    showMessage('Не удалось удалить отметки.', 'error');
  }
}

function startFrequencyEditing() {
  if (!requireAdminAccess()) return;

  state.editingFrequencies = true;
  state.editedBands = cloneBands(state.bands);
  state.editedMinGap = state.settings.minFrequencyGap;
  renderFrequencyEditor();
}

function cancelFrequencyEditing() {
  state.editingFrequencies = false;
  applyAccessMode();
  state.editedBands = null;
  state.editedMinGap = state.settings.minFrequencyGap;
  renderFrequencyEditor();
}

function handleFrequencyDraftChange(bandKey, channelNumber, value) {
  if (!state.editingFrequencies || !state.editedBands) return;

  const band = state.editedBands.find((item) => item.key === bandKey);
  if (!band) return;

  band.channels[channelNumber - 1] = value;
}

function validateFrequencyDraft(bands, minGapRaw) {
  const minGap = Number(minGapRaw);

  if (!Number.isInteger(minGap) || minGap < 100) {
    return 'Минимальный шаг должен быть целым числом не меньше 100.';
  }

  const flattened = [];

  for (const band of bands) {
    for (let index = 0; index < band.channels.length; index += 1) {
      const rawValue = band.channels[index];
      const prepared = String(rawValue ?? '').trim();

      if (!prepared) {
        return `${band.label}, CH ${index + 1}: ячейка не может быть пустой.`;
      }

      const frequency = Number(prepared);
      if (!Number.isInteger(frequency) || frequency <= 0) {
        return `${band.label}, CH ${index + 1}: укажите целое положительное число.`;
      }

      flattened.push({
        bandKey: band.key,
        bandLabel: band.label,
        channelNumber: index + 1,
        frequency,
      });
    }
  }

  const sorted = [...flattened].sort((a, b) => a.frequency - b.frequency);
  for (let index = 1; index < sorted.length; index += 1) {
    const previous = sorted[index - 1];
    const current = sorted[index];
    const gap = current.frequency - previous.frequency;
    if (gap < minGap) {
      return `Недостаточный шаг: между ${previous.bandLabel} CH ${previous.channelNumber} (${previous.frequency}) и ${current.bandLabel} CH ${current.channelNumber} (${current.frequency}) только ${gap}. Нужно минимум ${minGap}.`;
    }
  }

  return null;
}

function getFrequencyRowsFromBands(bands) {
  return bands.flatMap((band) => band.channels.map((frequency, index) => ({
    band_key: band.key,
    channel_number: index + 1,
    frequency: Number(frequency),
  })));
}

async function saveFrequencies() {
  if (!requireAdminAccess()) return;
  if (!state.editingFrequencies || !state.editedBands) return;

  const validationError = validateFrequencyDraft(state.editedBands, refs.minGapInput.value);
  if (validationError) {
    showMessage(validationError, 'error');
    return;
  }

  const normalizedBands = cloneBands(state.editedBands).map((band) => ({
    ...band,
    channels: band.channels.map((value) => Number(String(value).trim())),
  }));
  const minGap = Number(refs.minGapInput.value);

  try {
    const [channelsResult, settingsResult] = await Promise.all([
      state.adminSupabase
        .from('band_channels')
        .upsert(getFrequencyRowsFromBands(normalizedBands), { onConflict: 'band_key,channel_number' }),
      state.adminSupabase
        .from('app_settings')
        .upsert({ id: 1, min_frequency_gap: minGap }, { onConflict: 'id' }),
    ]);

    if (channelsResult.error) throw channelsResult.error;
    if (settingsResult.error) throw settingsResult.error;

    state.bands = normalizedBands;
    state.settings.minFrequencyGap = minGap;
    state.editingFrequencies = false;
    state.editedBands = null;
    state.editedMinGap = minGap;
    rebuildFrequencyViews();
    renderFrequencyEditor();
    showMessage('Частоты сохранены.', 'success');
  } catch (error) {
    console.error(error);
    showMessage('Не удалось сохранить частоты.', 'error');
  }
}

function renderFrequencyEditor() {
  const admin = isAdmin();
  refs.editFrequenciesButton.hidden = !admin || state.editingFrequencies;
  refs.saveFrequenciesButton.hidden = !admin || !state.editingFrequencies;
  refs.cancelFrequenciesButton.hidden = !state.editingFrequencies;
  refs.frequencyEditor.hidden = !admin || !state.editingFrequencies;

  const currentMinGap = state.editingFrequencies ? state.editedMinGap : state.settings.minFrequencyGap;
  refs.minGapInput.disabled = !admin || !state.editingFrequencies;
  refs.minGapInput.value = String(currentMinGap ?? state.settings.minFrequencyGap ?? 100);

  if (!state.editingFrequencies) {
    refs.frequencySummary.textContent = admin
      ? `Текущий минимальный шаг между частотами: ${state.settings.minFrequencyGap}. Для изменения откройте редактор.`
      : `Текущий минимальный шаг между частотами: ${state.settings.minFrequencyGap}. Редактирование доступно только администратору.`;
    refs.frequencyBandEditor.innerHTML = '';
    return;
  }

  refs.frequencySummary.textContent = 'Измените частоты, затем сохраните. Пустые ячейки и шаг меньше указанного значения не допускаются.';
  refs.frequencyBandEditor.innerHTML = '';

  (state.editedBands || []).forEach((band) => {
    const card = document.createElement('article');
    card.className = 'frequency-band-card';

    const title = document.createElement('div');
    title.innerHTML = `
      <h3>${band.label}</h3>
      <p class="muted small">Все значения сохраняются в общую базу.</p>
    `;

    const grid = document.createElement('div');
    grid.className = 'frequency-input-grid';

    band.channels.forEach((frequency, index) => {
      const field = document.createElement('label');
      field.className = 'frequency-input-item';

      const label = document.createElement('span');
      label.textContent = `CH ${index + 1}`;

      const input = document.createElement('input');
      input.type = 'number';
      input.className = 'text-input';
      input.min = '1';
      input.step = '1';
      input.required = true;
      input.value = String(frequency ?? '');
      input.addEventListener('input', (event) => {
        handleFrequencyDraftChange(band.key, index + 1, event.target.value);
      });

      field.append(label, input);
      grid.append(field);
    });

    card.append(title, grid);
    refs.frequencyBandEditor.append(card);
  });
}

async function saveNoteFromForm() {
  if (!requireAdminAccess()) return;

  const title = refs.noteTitleInput.value.trim();
  const content = refs.noteTextInput.value.trim();

  if (!title) {
    showMessage('Введите заголовок заметки.', 'error');
    return;
  }

  if (!content) {
    showMessage('Введите текст заметки.', 'error');
    return;
  }

  refs.addNoteButton.disabled = true;

  try {
    const { error } = await state.adminSupabase
      .from('notes')
      .insert({ title, content });

    if (error) throw error;

    refs.noteTitleInput.value = '';
    refs.noteTextInput.value = '';
    await loadNotes();
    renderNotes();
    showMessage('Заметка сохранена.', 'success');
  } catch (error) {
    console.error(error);
    showMessage('Не удалось сохранить заметку.', 'error');
  } finally {
    refs.addNoteButton.disabled = false;
  }
}

function startEditingNote(noteId) {
  if (!requireAdminAccess()) return;

  const note = state.notes.find((item) => item.id === noteId);
  if (!note) return;

  state.editingNoteId = noteId;
  state.noteDraft = {
    title: note.title,
    content: note.content,
  };
  renderNotes();
}

function cancelEditingNote() {
  state.editingNoteId = null;
  state.noteDraft = null;
  renderNotes();
}

async function saveEditedNote(noteId) {
  if (!requireAdminAccess()) return;
  if (state.editingNoteId !== noteId || !state.noteDraft) return;

  const title = String(state.noteDraft.title || '').trim();
  const content = String(state.noteDraft.content || '').trim();

  if (!title) {
    showMessage('Введите заголовок заметки.', 'error');
    return;
  }

  if (!content) {
    showMessage('Введите текст заметки.', 'error');
    return;
  }

  try {
    const { error } = await state.adminSupabase
      .from('notes')
      .update({ title, content })
      .eq('id', noteId);

    if (error) throw error;

    const note = state.notes.find((item) => item.id === noteId);
    if (note) {
      note.title = title;
      note.content = content;
      note.updatedAt = new Date().toISOString();
    }

    state.editingNoteId = null;
    state.noteDraft = null;
    renderNotes();
    showMessage('Заметка обновлена.', 'success');
  } catch (error) {
    console.error(error);
    showMessage('Не удалось обновить заметку.', 'error');
  }
}

async function deleteNote(noteId) {
  if (!requireAdminAccess()) return;

  const ok = window.confirm('Удалить заметку?');
  if (!ok) return;

  try {
    const { error } = await state.adminSupabase
      .from('notes')
      .delete()
      .eq('id', noteId);

    if (error) throw error;

    state.notes = state.notes.filter((item) => item.id !== noteId);
    if (state.editingNoteId === noteId) {
      state.editingNoteId = null;
      state.noteDraft = null;
    }
    renderNotes();
    showMessage('Заметка удалена.', 'success');
  } catch (error) {
    console.error(error);
    showMessage('Не удалось удалить заметку.', 'error');
  }
}

function formatDateTime(value) {
  if (!value) return '';

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';

  return new Intl.DateTimeFormat('ru-RU', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(date);
}

function renderAll() {
  applyAccessMode();
  renderMarks();
  renderLegend();
  renderFrequencyEditor();
  renderNotes();
}

function mapLegendModel(item) {
  return {
    id: item.id,
    modelName: String(item.model_name || ''),
    modelNumber: String(item.model_number || ''),
    status: normalizeBoardStatus(item.status),
    sortOrder: Number.isFinite(Number(item.sort_order)) ? Number(item.sort_order) : 0,
  };
}

function getLegendModels(color) {
  const normalizedColor = normalizeHex(color);
  return normalizedColor ? [...(state.legendModels[normalizedColor] || [])] : [];
}

function buildLegendModelsSummary(color) {
  return getLegendModels(color)
    .map((item) => `${item.modelName} — ${item.modelNumber} [${getBoardStatusLabel(item.status)}]`)
    .join('\n');
}

function upsertLegendModelState(color, model) {
  const normalizedColor = normalizeHex(color);
  if (!normalizedColor || !model?.id) return;

  const bucket = state.legendModels[normalizedColor] ? [...state.legendModels[normalizedColor]] : [];
  const nextModel = {
    id: model.id,
    modelName: String(model.modelName || ''),
    modelNumber: String(model.modelNumber || ''),
    status: normalizeBoardStatus(model.status),
    sortOrder: Number.isFinite(Number(model.sortOrder)) ? Number(model.sortOrder) : 0,
  };
  const existingIndex = bucket.findIndex((item) => item.id === nextModel.id);

  if (existingIndex >= 0) {
    bucket[existingIndex] = nextModel;
  } else {
    bucket.push(nextModel);
  }

  bucket.sort((a, b) => a.sortOrder - b.sortOrder || a.id - b.id);
  state.legendModels[normalizedColor] = bucket;
}

function normalizeBoardStatus(value) {
  const prepared = String(value || '').trim().toLowerCase();
  return BOARD_STATUS_LABELS[prepared] ? prepared : DEFAULT_BOARD_STATUS;
}

function getBoardStatusLabel(status) {
  return BOARD_STATUS_LABELS[normalizeBoardStatus(status)] || BOARD_STATUS_LABELS[DEFAULT_BOARD_STATUS];
}

function createBoardStatusSelect(selectedStatus = DEFAULT_BOARD_STATUS) {
  const select = document.createElement('select');
  select.className = 'text-input';

  BOARD_STATUS_OPTIONS.forEach((option) => {
    const node = document.createElement('option');
    node.value = option.value;
    node.textContent = option.label;
    select.append(node);
  });

  select.value = normalizeBoardStatus(selectedStatus);
  return select;
}

function createBoardStatusBadge(status) {
  const normalizedStatus = normalizeBoardStatus(status);
  const badge = document.createElement('span');
  badge.className = 'legend-model-status-badge';
  badge.dataset.status = normalizedStatus;
  badge.textContent = getBoardStatusLabel(normalizedStatus);
  return badge;
}

function removeLegendModelState(color, modelId) {
  const normalizedColor = normalizeHex(color);
  if (!normalizedColor) return;

  const bucket = (state.legendModels[normalizedColor] || []).filter((item) => item.id !== modelId);
  if (bucket.length) {
    state.legendModels[normalizedColor] = bucket;
  } else {
    delete state.legendModels[normalizedColor];
  }
}

function renderMarks() {
  state.cellNodes.forEach((nodes, cellId) => {
    const color = state.marks[cellId];
    const label = color ? state.legend[color] : '';
    const frequency = getFrequencyByCellId(cellId);
    const textColor = color ? getReadableTextColor(color) : '';
    const modelsSummary = color ? buildLegendModelsSummary(color) : '';
    const title = [label ? `${frequency} — ${label}` : String(frequency), modelsSummary].filter(Boolean).join('\n');

    nodes.forEach((node) => {
      node.title = title;
      node.classList.toggle('read-only-cell', !isAdmin());
      if (color) {
        node.classList.add('active-cell');
        node.style.backgroundColor = color;
        node.style.color = textColor;
      } else {
        node.classList.remove('active-cell');
        node.style.backgroundColor = '';
        node.style.color = '';
      }
    });
  });

  setSelectedColor(state.selectedColor);
}

function renderLegend() {
  const entries = Object.entries(state.legend).sort((a, b) => a[0].localeCompare(b[0]));
  const admin = isAdmin();
  refs.legendList.innerHTML = '';
  refs.legendEmpty.hidden = entries.length > 0;

  entries.forEach(([color, label]) => {
    const item = document.createElement('div');
    item.className = 'legend-item';

    const top = document.createElement('div');
    top.className = 'legend-item__top';

    const colorButton = document.createElement('button');
    colorButton.type = 'button';
    colorButton.className = 'legend-color-box';
    colorButton.style.backgroundColor = color;
    colorButton.title = admin ? 'Выбрать этот цвет' : 'Цвет из легенды';
    colorButton.disabled = !admin;
    colorButton.addEventListener('click', () => {
      if (!admin) return;
      setSelectedColor(color);
      refs.legendText.value = label;
      refs.legendText.focus();
    });

    const code = document.createElement('div');
    code.className = 'legend-code';
    code.textContent = color;

    top.append(colorButton, code);

    if (!admin) {
      const readonlyLabel = document.createElement('div');
      readonlyLabel.className = 'legend-label-text';
      readonlyLabel.textContent = label;
      top.append(readonlyLabel);
    } else {
      const input = document.createElement('input');
      input.className = 'text-input';
      input.type = 'text';
      input.value = label;
      input.placeholder = 'Подпись цвета';

      input.addEventListener('keydown', (event) => {
        if (event.key === 'Enter') {
          event.preventDefault();
          saveLegend(color, input.value);
        }
      });

      const saveButton = document.createElement('button');
      saveButton.type = 'button';
      saveButton.className = 'secondary-button';
      saveButton.textContent = 'Сохранить';
      saveButton.addEventListener('click', () => saveLegend(color, input.value));

      const deleteButton = document.createElement('button');
      deleteButton.type = 'button';
      deleteButton.className = 'ghost-button';
      deleteButton.textContent = 'Удалить';
      deleteButton.addEventListener('click', () => deleteLegend(color));

      top.append(input, saveButton, deleteButton);
    }

    const modelsSection = document.createElement('div');
    modelsSection.className = 'legend-models';

    const modelsHeader = document.createElement('div');
    modelsHeader.className = 'legend-models__header';

    const modelsTitle = document.createElement('h3');
    modelsTitle.className = 'legend-models__title';
    modelsTitle.textContent = 'Борты для этого цвета';

    const modelsHint = document.createElement('p');
    modelsHint.className = 'muted small';
    modelsHint.textContent = admin
      ? 'Добавляйте борты, указывайте номер и статус. Их увидят все пользователи.'
      : 'Список бортов, номеров и статусов для выбранного цвета.';

    modelsHeader.append(modelsTitle, modelsHint);

    const models = getLegendModels(color);

    if (models.length) {
      const tableWrap = document.createElement('div');
      tableWrap.className = 'legend-models__table-wrap';

      const table = document.createElement('table');
      table.className = 'legend-models-table';

      const head = document.createElement('thead');
      const headRow = document.createElement('tr');
      ['Название модели', 'Номер', 'Статус'].forEach((titleText) => {
        const th = document.createElement('th');
        th.textContent = titleText;
        headRow.append(th);
      });

      if (admin) {
        const actionsHead = document.createElement('th');
        actionsHead.textContent = 'Действия';
        headRow.append(actionsHead);
      }

      head.append(headRow);
      table.append(head);

      const body = document.createElement('tbody');
      models.forEach((model) => {
        const row = document.createElement('tr');

        if (admin) {
          const nameCell = document.createElement('td');
          const nameInput = document.createElement('input');
          nameInput.type = 'text';
          nameInput.className = 'text-input legend-model-input';
          nameInput.value = model.modelName;
          nameInput.placeholder = 'Название модели';
          nameCell.append(nameInput);

          const numberCell = document.createElement('td');
          const numberInput = document.createElement('input');
          numberInput.type = 'text';
          numberInput.className = 'text-input legend-model-input';
          numberInput.value = model.modelNumber;
          numberInput.placeholder = 'Номер';
          numberCell.append(numberInput);

          const statusCell = document.createElement('td');
          const statusSelect = createBoardStatusSelect(model.status);
          statusSelect.classList.add('legend-model-status-select');
          const handleSave = () => updateLegendModel(model.id, color, nameInput.value, numberInput.value, statusSelect.value, model.sortOrder);

          [nameInput, numberInput].forEach((inputNode) => {
            inputNode.addEventListener('keydown', (event) => {
              if (event.key === 'Enter') {
                event.preventDefault();
                handleSave();
              }
            });
          });
          statusSelect.addEventListener('change', handleSave);
          statusCell.append(statusSelect);

          const actionsCell = document.createElement('td');
          const actions = document.createElement('div');
          actions.className = 'legend-model-actions';

          const saveButton = document.createElement('button');
          saveButton.type = 'button';
          saveButton.className = 'secondary-button';
          saveButton.textContent = 'Сохранить';
          saveButton.addEventListener('click', handleSave);

          const deleteButton = document.createElement('button');
          deleteButton.type = 'button';
          deleteButton.className = 'ghost-button';
          deleteButton.textContent = 'Удалить';
          deleteButton.addEventListener('click', () => deleteLegendModel(model.id, color));

          actions.append(saveButton, deleteButton);
          actionsCell.append(actions);
          row.append(nameCell, numberCell, statusCell, actionsCell);
        } else {
          const nameCell = document.createElement('td');
          nameCell.textContent = model.modelName;
          const numberCell = document.createElement('td');
          numberCell.textContent = model.modelNumber;
          const statusCell = document.createElement('td');
          statusCell.append(createBoardStatusBadge(model.status));
          row.append(nameCell, numberCell, statusCell);
        }

        body.append(row);
      });

      table.append(body);
      tableWrap.append(table);
      modelsSection.append(modelsHeader, tableWrap);
    } else {
      const empty = document.createElement('p');
      empty.className = 'muted small legend-models-empty';
      empty.textContent = 'Для этого цвета пока нет добавленных бортов.';
      modelsSection.append(modelsHeader, empty);
    }

    if (admin) {
      const addForm = document.createElement('div');
      addForm.className = 'legend-models__form';

      const nameInput = document.createElement('input');
      nameInput.type = 'text';
      nameInput.className = 'text-input';
      nameInput.placeholder = 'Название модели';

      const numberInput = document.createElement('input');
      numberInput.type = 'text';
      numberInput.className = 'text-input';
      numberInput.placeholder = 'Номер';

      const statusSelect = createBoardStatusSelect(DEFAULT_BOARD_STATUS);
      statusSelect.classList.add('legend-model-status-select');

      const addButton = document.createElement('button');
      addButton.type = 'button';
      addButton.className = 'primary-button';
      addButton.textContent = 'Добавить борт';

      const handleAdd = async () => {
        const saved = await addLegendModel(color, nameInput.value, numberInput.value, statusSelect.value);
        if (saved) {
          nameInput.value = '';
          numberInput.value = '';
          statusSelect.value = DEFAULT_BOARD_STATUS;
          nameInput.focus();
        }
      };

      addButton.addEventListener('click', handleAdd);
      [numberInput, statusSelect].forEach((field) => {
        field.addEventListener('keydown', (event) => {
          if (event.key === 'Enter') {
            event.preventDefault();
            handleAdd();
          }
        });
      });

      addForm.append(nameInput, numberInput, statusSelect, addButton);
      modelsSection.append(addForm);
    }

    item.append(top, modelsSection);
    refs.legendList.append(item);
  });
}

async function addLegendModel(color, modelName, modelNumber, status = DEFAULT_BOARD_STATUS) {
  if (!requireAdminAccess()) return false;

  const normalizedColor = normalizeHex(color);
  const preparedName = String(modelName || '').trim();
  const preparedNumber = String(modelNumber || '').trim();
  const preparedStatus = normalizeBoardStatus(status);

  if (!normalizedColor || !state.legend[normalizedColor]) {
    showMessage('Сначала сохраните подпись для выбранного цвета.', 'error');
    return false;
  }

  if (!preparedName || !preparedNumber) {
    showMessage('Заполните название модели и номер.', 'error');
    return false;
  }

  const existingModels = getLegendModels(normalizedColor);
  const lastSortOrder = existingModels.length ? existingModels[existingModels.length - 1].sortOrder : -1;

  try {
    const { data, error } = await state.adminSupabase
      .from('legend_models')
      .insert({
        color: normalizedColor,
        model_name: preparedName,
        model_number: preparedNumber,
        status: preparedStatus,
        sort_order: lastSortOrder + 1,
      })
      .select('id, color, model_name, model_number, status, sort_order')
      .single();

    if (error) throw error;

    const savedColor = normalizeHex(data.color) || normalizedColor;
    upsertLegendModelState(savedColor, mapLegendModel(data));
    renderLegend();
    renderMarks();
    showMessage('Борт добавлен.', 'success');
    return true;
  } catch (error) {
    console.error(error);
    showMessage('Не удалось добавить борт.', 'error');
    return false;
  }
}

async function updateLegendModel(modelId, color, modelName, modelNumber, status = DEFAULT_BOARD_STATUS, sortOrder = 0) {
  if (!requireAdminAccess()) return false;

  const normalizedColor = normalizeHex(color);
  const preparedName = String(modelName || '').trim();
  const preparedNumber = String(modelNumber || '').trim();
  const preparedStatus = normalizeBoardStatus(status);

  if (!normalizedColor || !modelId) {
    showMessage('Не удалось определить запись модели.', 'error');
    return false;
  }

  if (!preparedName || !preparedNumber) {
    showMessage('Заполните название модели и номер.', 'error');
    return false;
  }

  try {
    const { error } = await state.adminSupabase
      .from('legend_models')
      .update({
        model_name: preparedName,
        model_number: preparedNumber,
        status: preparedStatus,
        sort_order: Number.isFinite(Number(sortOrder)) ? Number(sortOrder) : 0,
      })
      .eq('id', modelId);

    if (error) throw error;

    upsertLegendModelState(normalizedColor, {
      id: modelId,
      modelName: preparedName,
      modelNumber: preparedNumber,
      status: preparedStatus,
      sortOrder,
    });
    renderLegend();
    renderMarks();
    showMessage('Борт обновлен.', 'success');
    return true;
  } catch (error) {
    console.error(error);
    showMessage('Не удалось обновить борт.', 'error');
    return false;
  }
}

async function deleteLegendModel(modelId, color) {
  if (!requireAdminAccess()) return false;

  try {
    const { error } = await state.adminSupabase
      .from('legend_models')
      .delete()
      .eq('id', modelId);

    if (error) throw error;

    removeLegendModelState(color, modelId);
    renderLegend();
    renderMarks();
    showMessage('Борт удален.', 'success');
    return true;
  } catch (error) {
    console.error(error);
    showMessage('Не удалось удалить борт.', 'error');
    return false;
  }
}

function renderNotes() {
  const admin = isAdmin();
  refs.notesList.innerHTML = '';
  refs.notesEmpty.hidden = state.notes.length > 0;

  state.notes.forEach((note) => {
    const item = document.createElement('article');
    item.className = 'note-item';

    if (admin && state.editingNoteId === note.id && state.noteDraft) {
      const titleField = document.createElement('label');
      titleField.className = 'field';
      titleField.innerHTML = '<span class="field-label">Заголовок</span>';

      const titleInput = document.createElement('input');
      titleInput.type = 'text';
      titleInput.className = 'text-input';
      titleInput.value = state.noteDraft.title;
      titleInput.addEventListener('input', (event) => {
        state.noteDraft.title = event.target.value;
      });
      titleField.append(titleInput);

      const contentField = document.createElement('label');
      contentField.className = 'field';
      contentField.innerHTML = '<span class="field-label">Текст</span>';

      const contentInput = document.createElement('textarea');
      contentInput.className = 'text-input note-textarea';
      contentInput.value = state.noteDraft.content;
      contentInput.addEventListener('input', (event) => {
        state.noteDraft.content = event.target.value;
      });
      contentField.append(contentInput);

      const actions = document.createElement('div');
      actions.className = 'note-actions';

      const saveButton = document.createElement('button');
      saveButton.type = 'button';
      saveButton.className = 'primary-button';
      saveButton.textContent = 'Сохранить';
      saveButton.addEventListener('click', () => saveEditedNote(note.id));

      const cancelButton = document.createElement('button');
      cancelButton.type = 'button';
      cancelButton.className = 'ghost-button';
      cancelButton.textContent = 'Отмена';
      cancelButton.addEventListener('click', cancelEditingNote);

      actions.append(saveButton, cancelButton);
      item.append(titleField, contentField, actions);
      refs.notesList.append(item);
      return;
    }

    const meta = document.createElement('div');
    meta.className = 'note-meta';

    const titleBox = document.createElement('div');
    const title = document.createElement('h3');
    title.textContent = note.title;
    const updated = document.createElement('p');
    updated.className = 'muted small';
    updated.textContent = `Обновлено: ${formatDateTime(note.updatedAt || note.createdAt)}`;
    titleBox.append(title, updated);

    if (admin) {
      const actions = document.createElement('div');
      actions.className = 'note-actions';

      const editButton = document.createElement('button');
      editButton.type = 'button';
      editButton.className = 'secondary-button';
      editButton.textContent = 'Редактировать';
      editButton.addEventListener('click', () => startEditingNote(note.id));

      const deleteButton = document.createElement('button');
      deleteButton.type = 'button';
      deleteButton.className = 'ghost-button';
      deleteButton.textContent = 'Удалить';
      deleteButton.addEventListener('click', () => deleteNote(note.id));

      actions.append(editButton, deleteButton);
      meta.append(titleBox, actions);
    } else {
      meta.append(titleBox);
    }

    const content = document.createElement('p');
    content.className = 'note-content';
    content.textContent = note.content;

    item.append(meta, content);
    refs.notesList.append(item);
  });
}

function getFrequencyByCellId(cellId) {
  const [bandKey, channelNumber] = String(cellId || '').split('-');
  const band = state.bands.find((item) => item.key === bandKey);
  return band?.channels?.[Number(channelNumber) - 1] ?? '';
}

function formatExportTimestamp() {
  const now = new Date();
  const pad = (value) => String(value).padStart(2, '0');
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}_${pad(now.getHours())}-${pad(now.getMinutes())}`;
}

function slugifyFilePart(value) {
  return String(value || 'freqmarks')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9а-яё]+/gi, '-')
    .replace(/^-+|-+$/g, '') || 'freqmarks';
}

function createSheet(headers, rows) {
  const worksheet = window.XLSX.utils.aoa_to_sheet([headers, ...rows]);
  const range = window.XLSX.utils.decode_range(worksheet['!ref'] || 'A1');
  const widths = headers.map((header, columnIndex) => {
    const values = [header, ...rows.map((row) => row[columnIndex] ?? '')];
    const maxLength = values.reduce((current, value) => Math.max(current, String(value).length), 0);
    return { wch: Math.min(Math.max(maxLength + 2, 12), 42) };
  });
  worksheet['!cols'] = widths;
  worksheet['!autofilter'] = { ref: window.XLSX.utils.encode_range(range) };
  return worksheet;
}

function getLegendEntryRows() {
  return Object.entries(state.legend)
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([color, label]) => [color, label, getLegendModels(color).length]);
}

function getLegendModelRows() {
  return Object.entries(state.legendModels)
    .sort((a, b) => a[0].localeCompare(b[0]))
    .flatMap(([color, models]) => models.map((model) => [
      color,
      state.legend[color] || '',
      model.modelName,
      model.modelNumber,
      getBoardStatusLabel(model.status),
      model.id,
      model.sortOrder,
    ]));
}

function getFrequencyRows() {
  return state.bands.flatMap((band) => band.channels.map((frequency, index) => {
    const cellId = `${band.key}-${index + 1}`;
    const color = state.marks[cellId] || '';
    return [
      band.key,
      band.label,
      index + 1,
      cellId,
      frequency,
      color,
      color ? state.legend[color] || '' : '',
      color ? getLegendModels(color).map((item) => `${item.modelName} — ${item.modelNumber} [${getBoardStatusLabel(item.status)}]`).join('; ') : '',
    ];
  }));
}

function getNotesRows() {
  return state.notes.map((note) => [note.id, note.title, note.content, formatDateTime(note.createdAt), formatDateTime(note.updatedAt)]);
}

async function exportAllDataToExcel() {
  if (!window.XLSX?.utils?.book_new) {
    showMessage('Библиотека Excel не загрузилась. Обновите страницу и попробуйте снова.', 'error');
    return;
  }

  const button = refs.exportExcelButton;
  if (button) {
    button.disabled = true;
    button.textContent = 'Экспорт...';
  }

  try {
    const workbook = window.XLSX.utils.book_new();

    window.XLSX.utils.book_append_sheet(workbook, createSheet(
      ['Параметр', 'Значение'],
      [
        ['Название страницы', APP_TITLE],
        ['Роль текущего сеанса', getAccessRoleMeta(state.accessRole).badge],
        ['Минимальный шаг частот', state.settings.minFrequencyGap],
        ['Цветов в легенде', Object.keys(state.legend).length],
        ['Бортов', getLegendModelRows().length],
        ['Отмеченных ячеек', Object.keys(state.marks).length],
        ['Заметок', state.notes.length],
        ['Дата экспорта', new Date().toLocaleString('ru-RU')],
      ],
    ), 'Сводка');

    window.XLSX.utils.book_append_sheet(workbook, createSheet(
      ['Band key', 'Band', 'Канал', 'Cell ID', 'Частота', 'Цвет', 'Подпись цвета', 'Борты этого цвета'],
      getFrequencyRows(),
    ), 'Частоты');

    window.XLSX.utils.book_append_sheet(workbook, createSheet(
      ['Цвет', 'Подпись', 'Количество бортов'],
      getLegendEntryRows(),
    ), 'Легенда');

    window.XLSX.utils.book_append_sheet(workbook, createSheet(
      ['Цвет', 'Подпись цвета', 'Название модели', 'Номер', 'Статус', 'ID', 'Порядок'],
      getLegendModelRows(),
    ), 'Борты');

    window.XLSX.utils.book_append_sheet(workbook, createSheet(
      ['ID', 'Заголовок', 'Текст', 'Создано', 'Обновлено'],
      getNotesRows(),
    ), 'Заметки');

    const filename = `${slugifyFilePart(APP_TITLE)}-export-${formatExportTimestamp()}.xlsx`;
    window.XLSX.writeFile(workbook, filename, { compression: true });
    showMessage('Экспорт Excel готов.', 'success');
  } catch (error) {
    console.error(error);
    showMessage('Не удалось сформировать Excel-файл.', 'error');
  } finally {
    if (button) {
      button.disabled = false;
      button.textContent = 'Экспорт в Excel';
    }
  }
}

let messageTimer = null;

function showMessage(text, kind = 'success') {
  refs.actionMessage.hidden = false;
  refs.actionMessage.textContent = text;
  refs.actionMessage.classList.remove('error', 'success');
  refs.actionMessage.classList.add(kind);

  window.clearTimeout(messageTimer);
  messageTimer = window.setTimeout(() => {
    refs.actionMessage.hidden = true;
    refs.actionMessage.textContent = '';
  }, 3200);
}
