/*
  Витрина demo.skif4er.ru управляется отсюда.
  Чтобы перевести карточку из обзорного режима в live-demo режим,
  достаточно заменить primaryUrl и primaryLabel у нужного объекта.
*/

const DEMOS = [
  {
    title: 'CajeerEngine',
    group: 'engine',
    groupLabel: 'Движки',
    meta: 'core / engineering layer',
    tone: 'active',
    statusLabel: 'published',
    description:
      'Фундамент для модульного роста, системного кода и долгоживущих open-source продуктов.',
    tags: ['Engine', 'Core', 'OSS'],
    primaryLabel: 'Открыть обзор',
    primaryUrl: 'https://skif4er.ru/CajeerEngine/',
    repoUrl: 'https://github.com/CajeerTeam',
    docsUrl: 'https://docs.skif4er.ru/'
  },
  {
    title: 'Arog',
    group: 'framework',
    groupLabel: 'Фреймворки',
    meta: 'framework ecosystem',
    tone: 'active',
    statusLabel: 'ecosystem',
    description:
      'Набор фреймворков и библиотек для независимой разработки: от клиентского слоя до серверной логики.',
    tags: ['Frameworks', 'RU', 'Ecosystem'],
    primaryLabel: 'Открыть обзор',
    primaryUrl: 'https://skif4er.ru/Arog/',
    repoUrl: 'https://github.com/CajeerTeam',
    docsUrl: 'https://docs.skif4er.ru/'
  },
  {
    title: 'NovaCMS',
    group: 'cms',
    groupLabel: 'CMS',
    meta: 'cms / editorial surface',
    tone: 'stable',
    statusLabel: 'ready',
    description:
      'Контентная система для проектов, где важны скорость работы, ясный интерфейс и предсказуемая редактура.',
    tags: ['CMS', 'Content', 'Editorial'],
    primaryLabel: 'Открыть обзор',
    primaryUrl: 'https://skif4er.ru/NovaCMS/',
    repoUrl: 'https://github.com/CajeerTeam',
    docsUrl: 'https://docs.skif4er.ru/'
  },
  {
    title: 'NexoraCMS',
    group: 'cms',
    groupLabel: 'CMS',
    meta: 'cms / governance layer',
    tone: 'stable',
    statusLabel: 'ready',
    description:
      'Направление для масштабируемых CMS-систем, где на первом месте управляемость, роли, процессы и точность.',
    tags: ['CMS', 'Governance', 'Roles'],
    primaryLabel: 'Открыть обзор',
    primaryUrl: 'https://skif4er.ru/Nexora/',
    repoUrl: 'https://github.com/CajeerTeam',
    docsUrl: 'https://docs.skif4er.ru/'
  },
  {
    title: 'Rog',
    group: 'cms',
    groupLabel: 'CMS',
    meta: 'cms / operational layer',
    tone: 'active',
    statusLabel: 'published',
    description:
      'Контентная система с фокусом на порядок, стабильность и спокойный операционный контур.',
    tags: ['CMS', 'RU', 'Operations'],
    primaryLabel: 'Открыть обзор',
    primaryUrl: 'https://skif4er.ru/Rog/',
    repoUrl: 'https://github.com/CajeerTeam',
    docsUrl: 'https://docs.skif4er.ru/'
  },
  {
    title: 'SkiF4er OSS Labs',
    group: 'lab',
    groupLabel: 'Labs',
    meta: 'prototypes / tooling / experiments',
    tone: 'lab',
    statusLabel: 'lab',
    description:
      'Поток быстрых прототипов, интерфейсных гипотез и утилит, которые можно показывать до выхода в основной продукт.',
    tags: ['Labs', 'Tooling', 'Prototype'],
    primaryLabel: 'Открыть GitHub',
    primaryUrl: 'https://github.com/TheSkiF4er',
    repoUrl: 'https://github.com/TheSkiF4er',
    docsUrl: 'https://docs.skif4er.ru/'
  }
];

const FILTER_LABELS = {
  all: 'Все',
  engine: 'Движки',
  framework: 'Фреймворки',
  cms: 'CMS',
  lab: 'Labs'
};

let activeFilter = 'all';
let revealObserver = null;

function escapeHtml(value) {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

function toneClass(tone) {
  if (tone === 'stable') return 'status-stable';
  if (tone === 'lab') return 'status-lab';
  return 'status-active';
}

function availableGroups() {
  const seen = new Set();
  const result = [];

  for (const demo of DEMOS) {
    if (!seen.has(demo.group)) {
      seen.add(demo.group);
      result.push(demo.group);
    }
  }

  return result;
}

function filteredDemos() {
  if (activeFilter === 'all') return DEMOS;
  return DEMOS.filter((demo) => demo.group === activeFilter);
}

function filterButtonTemplate(filterKey) {
  const label = FILTER_LABELS[filterKey] || filterKey;
  const isActive = filterKey === activeFilter ? ' active' : '';
  return `<button class="filter-pill${isActive}" type="button" data-filter="${escapeHtml(filterKey)}">${escapeHtml(label)}</button>`;
}

function demoCardTemplate(demo) {
  const docsButton = demo.docsUrl
    ? `<a class="btn btn-small btn-ghost" href="${escapeHtml(demo.docsUrl)}">Docs</a>`
    : '';

  return `
    <article class="card demo-card fade-in" data-group="${escapeHtml(demo.group)}">
      <div class="demo-top">
        <div>
          <div class="meta">${escapeHtml(demo.meta)}</div>
          <h3>${escapeHtml(demo.title)}</h3>
        </div>
        <span class="status ${toneClass(demo.tone)}">${escapeHtml(demo.statusLabel)}</span>
      </div>
      <p>${escapeHtml(demo.description)}</p>
      <div class="tag-list">
        ${demo.tags.map((tag) => `<span class="tag">${escapeHtml(tag)}</span>`).join('')}
      </div>
      <div class="demo-actions">
        <a class="btn btn-small btn-primary" href="${escapeHtml(demo.primaryUrl)}">${escapeHtml(demo.primaryLabel)}</a>
        <a class="btn btn-small btn-secondary" href="${escapeHtml(demo.repoUrl)}">GitHub</a>
        ${docsButton}
      </div>
    </article>`;
}

function renderFilters() {
  const filtersEl = document.getElementById('filters');
  if (!filtersEl) return;

  const keys = ['all', ...availableGroups()];
  filtersEl.innerHTML = keys.map(filterButtonTemplate).join('');
}

function renderDemoGrid() {
  const gridEl = document.getElementById('demo-grid');
  if (!gridEl) return;

  const demos = filteredDemos();
  gridEl.innerHTML = demos.map(demoCardTemplate).join('');

  if (!demos.length) {
    gridEl.innerHTML = `
      <div class="card fade-in">
        <div class="meta">empty</div>
        <h3>По этому фильтру пока нет карточек.</h3>
        <p>Добавь новый объект в массив <code>DEMOS</code> внутри <code>app.js</code>, чтобы расширить витрину.</p>
      </div>`;
  }
}

function updateMetrics() {
  const demoCount = DEMOS.length;
  const categoryCount = availableGroups().length;

  const demoMetric = document.getElementById('metric-demos');
  const categoryMetric = document.getElementById('metric-cats');
  const showcaseCount = document.getElementById('demo-count');
  const yearEl = document.getElementById('year');

  if (demoMetric) demoMetric.textContent = String(demoCount);
  if (categoryMetric) categoryMetric.textContent = String(categoryCount);
  if (showcaseCount) showcaseCount.textContent = String(demoCount);
  if (yearEl) yearEl.textContent = String(new Date().getFullYear());
}

function observeRevealElements() {
  const candidates = document.querySelectorAll('.fade-in:not(.visible)');

  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
    candidates.forEach((el) => el.classList.add('visible'));
    return;
  }

  if (!revealObserver) {
    revealObserver = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add('visible');
            revealObserver.unobserve(entry.target);
          }
        });
      },
      { threshold: 0.12 }
    );
  }

  candidates.forEach((el) => revealObserver.observe(el));
}

function rerenderShowcase() {
  renderFilters();
  renderDemoGrid();
  observeRevealElements();
}

function initShowcase() {
  updateMetrics();
  rerenderShowcase();

  const filtersEl = document.getElementById('filters');
  if (!filtersEl) return;

  filtersEl.addEventListener('click', (event) => {
    const button = event.target.closest('[data-filter]');
    if (!button) return;

    activeFilter = button.getAttribute('data-filter') || 'all';
    rerenderShowcase();
  });
}

document.addEventListener('DOMContentLoaded', () => {
  initShowcase();
  observeRevealElements();
});
