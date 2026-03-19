import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm';
import { APP_CONFIG } from './config.js';

const DEFAULT_COLOR = normalizeHex(APP_CONFIG.defaultColor) || '#D32F2F';
const SESSION_KEY = 'fpv-table-password-hash';

const BANDS = [
  { key: 'A', label: 'Band - A', channels: [5865, 5845, 5825, 5805, 5785, 5765, 5745, 5725] },
  { key: 'B', label: 'Band - b', channels: [5733, 5752, 5771, 5790, 5809, 5828, 5847, 5866] },
  { key: 'E', label: 'Band - E', channels: [5705, 5685, 5665, 5645, 5885, 5905, 5925, 5945] },
  { key: 'F', label: 'Band - F', channels: [5740, 5760, 5780, 5800, 5820, 5840, 5860, 5880] },
  { key: 'R', label: 'Band - r', channels: [5658, 5695, 5732, 5769, 5806, 5843, 5880, 5917] },
  { key: 'U', label: 'Band - U', channels: [5325, 5348, 5366, 5384, 5402, 5420, 5438, 5456] },
  { key: 'O', label: 'Band - o', channels: [5474, 5492, 5510, 5528, 5546, 5564, 5582, 5600] },
  { key: 'L', label: 'Band - L', channels: [5333, 5373, 5413, 5453, 5493, 5533, 5573, 5613] },
  { key: 'H', label: 'Band - H', channels: [5653, 5693, 5733, 5773, 5813, 5853, 5893, 5933] },
];

const state = {
  supabase: null,
  passwordHash: '',
  selectedColor: DEFAULT_COLOR,
  marks: {},
  legend: {},
  cellNodes: new Map(),
  channels: [],
};

const refs = {
  setupCard: document.getElementById('setup-card'),
  loginScreen: document.getElementById('login-screen'),
  loginForm: document.getElementById('login-form'),
  loginButton: document.getElementById('login-button'),
  passwordInput: document.getElementById('password-input'),
  loginError: document.getElementById('login-error'),
  appScreen: document.getElementById('app-screen'),
  pageTitle: document.getElementById('page-title'),
  appTitle: document.getElementById('app-title'),
  syncStatus: document.getElementById('sync-status'),
  colorPicker: document.getElementById('color-picker'),
  colorHex: document.getElementById('color-hex'),
  currentColorPreview: document.getElementById('current-color-preview'),
  legendText: document.getElementById('legend-text'),
  addLegendButton: document.getElementById('add-legend-button'),
  resetButton: document.getElementById('reset-button'),
  logoutButton: document.getElementById('logout-button'),
  clearLegendButton: document.getElementById('clear-legend-button'),
  legendList: document.getElementById('legend-list'),
  legendEmpty: document.getElementById('legend-empty'),
  actionMessage: document.getElementById('action-message'),
  tableHead: document.getElementById('table-head'),
  tableBody: document.getElementById('table-body'),
  mobileBandList: document.getElementById('mobile-band-list'),
};

document.addEventListener('DOMContentLoaded', init);

function setVisibility(element, isVisible) {
  if (!element) return;
  element.hidden = !isVisible;
  element.style.display = isVisible ? '' : 'none';
}

async function init() {
  refs.pageTitle.textContent = APP_CONFIG.appTitle || 'FPV 5.8 GHz Table';
  refs.appTitle.textContent = APP_CONFIG.appTitle || 'FPV 5.8 GHz Table';
  buildTable();
  buildMobileCards();
  bindEvents();
  setSelectedColor(state.selectedColor);

  if (!isConfigured()) {
    showSetup();
    return;
  }

  state.supabase = createClient(APP_CONFIG.supabaseUrl, APP_CONFIG.supabaseAnonKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
    },
  });

  showLogin();
  setSyncStatus('Проверка настроек...', 'loading');

  try {
    state.passwordHash = await fetchPasswordHash();
  } catch (error) {
    console.error(error);
    showSetup('Не удалось получить пароль из базы. Проверьте config.js и выполните supabase-schema.sql.');
    return;
  }

  const savedHash = sessionStorage.getItem(SESSION_KEY);

  if (savedHash && savedHash === state.passwordHash) {
    await enterApp();
  } else {
    setSyncStatus('Ожидание входа', 'loading');
  }
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
  setVisibility(refs.setupCard, true);
  setVisibility(refs.loginScreen, false);
  setVisibility(refs.appScreen, false);

  if (message) {
    const note = document.createElement('p');
    note.className = 'inline-message error';
    note.textContent = message;
    refs.setupCard.append(note);
  }
}

function showLogin() {
  setVisibility(refs.setupCard, false);
  setVisibility(refs.loginScreen, true);
  setVisibility(refs.appScreen, false);
  refs.passwordInput.focus();
}

function showApp() {
  hideLoginError();
  refs.passwordInput.value = '';
  setVisibility(refs.setupCard, false);
  setVisibility(refs.loginScreen, false);
  setVisibility(refs.appScreen, true);
  window.scrollTo({ top: 0, behavior: 'smooth' });
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
    sessionStorage.removeItem(SESSION_KEY);
    unsubscribeRealtime();
    state.marks = {};
    state.legend = {};
    renderAll();
    showLogin();
    setSyncStatus('Ожидание входа', 'loading');
  });

  window.addEventListener('beforeunload', unsubscribeRealtime);
}

function buildTable() {
  const headRow = document.createElement('tr');
  headRow.innerHTML = '<th>Band</th>' + BANDS[0].channels.map((_, index) => `<th>CH ${index + 1}</th>`).join('');
  refs.tableHead.append(headRow);

  refs.tableBody.innerHTML = '';

  BANDS.forEach((band) => {
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

  BANDS.forEach((band) => {
    const card = document.createElement('article');
    card.className = 'mobile-band-card';

    const header = document.createElement('div');
    header.className = 'mobile-band-header';
    header.innerHTML = `
      <div>
        <h3>${band.label}</h3>
        <p class="muted small">Нажимайте только на числовые кнопки</p>
      </div>
      <span class="pill subtle">8 каналов</span>
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

function registerCellNode(cellId, node) {
  const current = state.cellNodes.get(cellId) || [];
  current.push(node);
  state.cellNodes.set(cellId, current);
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

async function fetchPasswordHash() {
  const { data, error } = await state.supabase
    .from('page_access')
    .select('password_hash')
    .eq('id', 1)
    .maybeSingle();

  if (error) throw error;
  if (!data?.password_hash) throw new Error('Row page_access(id=1) not found');
  return String(data.password_hash).trim().toLowerCase();
}

async function handleLogin(event) {
  event.preventDefault();
  hideLoginError();

  const password = refs.passwordInput.value.trim();
  if (!password) {
    showLoginError('Введите пароль.');
    return;
  }

  refs.loginButton.disabled = true;
  refs.loginButton.textContent = 'Проверка...';

  try {
    const enteredHash = await sha256(password);

    if (enteredHash !== state.passwordHash) {
      showLoginError('Неверный пароль.');
      return;
    }

    sessionStorage.setItem(SESSION_KEY, enteredHash);
    refs.passwordInput.value = '';
    await enterApp();
  } catch (error) {
    console.error(error);
    showLoginError('Не удалось проверить пароль. Проверьте подключение к базе.');
  } finally {
    refs.loginButton.disabled = false;
    refs.loginButton.textContent = 'Открыть таблицу';
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
  await Promise.all([loadMarks(), loadLegend()]);
  renderAll();
  subscribeRealtime();
  setSyncStatus('Онлайн', 'online');
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

function subscribeRealtime() {
  unsubscribeRealtime();

  const marksChannel = state.supabase
    .channel('fpv-cell-marks')
    .on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'cell_marks' },
      async () => {
        await loadMarks();
        renderMarks();
      }
    )
    .subscribe(handleRealtimeStatus);

  const legendChannel = state.supabase
    .channel('fpv-legend-items')
    .on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'legend_items' },
      async () => {
        await loadLegend();
        renderLegend();
        renderMarks();
      }
    )
    .subscribe(handleRealtimeStatus);

  state.channels = [marksChannel, legendChannel];
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
  const currentColor = state.marks[cellId];
  const nextColor = currentColor === state.selectedColor ? '' : state.selectedColor;

  try {
    if (nextColor) {
      const { error } = await state.supabase
        .from('cell_marks')
        .upsert({ cell_id: cellId, color: nextColor }, { onConflict: 'cell_id' });

      if (error) throw error;
      showMessage('Отметка сохранена.', 'success');
    } else {
      const { error } = await state.supabase
        .from('cell_marks')
        .delete()
        .eq('cell_id', cellId);

      if (error) throw error;
      showMessage('Отметка снята.', 'success');
    }
  } catch (error) {
    console.error(error);
    showMessage('Не удалось обновить ячейку.', 'error');
  }
}

async function saveLegendFromForm() {
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
    const { error } = await state.supabase
      .from('legend_items')
      .upsert({ color, label }, { onConflict: 'color' });

    if (error) throw error;

    refs.legendText.value = '';
    showMessage('Легенда сохранена.', 'success');
  } catch (error) {
    console.error(error);
    showMessage('Не удалось сохранить легенду.', 'error');
  }
}

async function saveLegend(color, label) {
  try {
    if (!label.trim()) {
      await deleteLegend(color);
      return;
    }

    const { error } = await state.supabase
      .from('legend_items')
      .upsert({ color, label: label.trim() }, { onConflict: 'color' });

    if (error) throw error;
    showMessage('Подпись обновлена.', 'success');
  } catch (error) {
    console.error(error);
    showMessage('Не удалось обновить подпись.', 'error');
  }
}

async function deleteLegend(color) {
  try {
    const { error } = await state.supabase
      .from('legend_items')
      .delete()
      .eq('color', color);

    if (error) throw error;
    showMessage('Подпись удалена.', 'success');
  } catch (error) {
    console.error(error);
    showMessage('Не удалось удалить подпись.', 'error');
  }
}

async function clearLegend() {
  try {
    const { error } = await state.supabase
      .from('legend_items')
      .delete()
      .neq('color', '#000000');

    if (error) throw error;
    showMessage('Легенда очищена.', 'success');
  } catch (error) {
    console.error(error);
    showMessage('Не удалось очистить легенду.', 'error');
  }
}

async function clearAllMarks() {
  try {
    const { error } = await state.supabase
      .from('cell_marks')
      .delete()
      .neq('cell_id', '__none__');

    if (error) throw error;
    showMessage('Все отметки удалены.', 'success');
  } catch (error) {
    console.error(error);
    showMessage('Не удалось удалить отметки.', 'error');
  }
}

function renderAll() {
  renderMarks();
  renderLegend();
}

function renderMarks() {
  state.cellNodes.forEach((nodes, cellId) => {
    const color = state.marks[cellId];
    const label = color ? state.legend[color] : '';
    const textColor = color ? getReadableTextColor(color) : '';
    const title = label ? `${getFrequencyByCellId(cellId)} — ${label}` : String(getFrequencyByCellId(cellId));

    nodes.forEach((node) => {
      node.title = title;
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
  refs.legendList.innerHTML = '';
  refs.legendEmpty.hidden = entries.length > 0;

  entries.forEach(([color, label]) => {
    const item = document.createElement('div');
    item.className = 'legend-item';

    const colorButton = document.createElement('button');
    colorButton.type = 'button';
    colorButton.className = 'legend-color-box';
    colorButton.style.backgroundColor = color;
    colorButton.title = 'Выбрать этот цвет';
    colorButton.addEventListener('click', () => {
      setSelectedColor(color);
      refs.legendText.value = label;
    });

    const code = document.createElement('div');
    code.className = 'legend-code';
    code.textContent = color;

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

    item.append(colorButton, code, input, saveButton, deleteButton);
    refs.legendList.append(item);
  });
}

function getFrequencyByCellId(cellId) {
  const [bandKey, channelNumber] = cellId.split('-');
  const band = BANDS.find((item) => item.key === bandKey);
  return band?.channels?.[Number(channelNumber) - 1] ?? '';
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
  }, 2600);
}
