const SITE_PASSWORD = 'fpv58';
const ACCESS_KEY = 'fpv-table-access';
const MARKS_KEY = 'fpv-table-marked-cells';

const passwordScreen = document.getElementById('password-screen');
const app = document.getElementById('app');
const passwordForm = document.getElementById('password-form');
const passwordInput = document.getElementById('password-input');
const passwordError = document.getElementById('password-error');
const resetButton = document.getElementById('reset-button');
const cells = [...document.querySelectorAll('.toggle-cell')];

function unlockPage() {
  passwordScreen.classList.add('hidden');
  app.classList.remove('hidden');
}

function loadMarks() {
  const markedKeys = JSON.parse(localStorage.getItem(MARKS_KEY) || '[]');
  const markedSet = new Set(markedKeys);

  cells.forEach((cell) => {
    cell.classList.toggle('active', markedSet.has(cell.dataset.key));
  });
}

function saveMarks() {
  const activeKeys = cells
    .filter((cell) => cell.classList.contains('active'))
    .map((cell) => cell.dataset.key);

  localStorage.setItem(MARKS_KEY, JSON.stringify(activeKeys));
}

function tryLogin(password) {
  if (password === SITE_PASSWORD) {
    sessionStorage.setItem(ACCESS_KEY, 'true');
    unlockPage();
    loadMarks();
    passwordError.textContent = '';
    passwordForm.reset();
    return;
  }

  passwordError.textContent = 'Неверный пароль';
  passwordInput.focus();
  passwordInput.select();
}

if (sessionStorage.getItem(ACCESS_KEY) === 'true') {
  unlockPage();
  loadMarks();
}

passwordForm.addEventListener('submit', (event) => {
  event.preventDefault();
  tryLogin(passwordInput.value.trim());
});

cells.forEach((cell) => {
  cell.addEventListener('click', () => {
    cell.classList.toggle('active');
    saveMarks();
  });
});

resetButton.addEventListener('click', () => {
  cells.forEach((cell) => cell.classList.remove('active'));
  saveMarks();
});
