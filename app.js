/**
 * TimeMetrics Pro - Interactive Analytics Engine
 */

// Configuration & Palettes
const WORKER_COLORS = {
  'Bartek': '#6366F1', // Indigo
  'Darek': '#F59E0B',  // Amber
  'Kamil': '#10B981',  // Emerald
  'Alicja': '#EC4899', // Pink
};

const TASK_COLORS = {
  'Klient X – programming': '#3B82F6',
  'Klient X – design': '#EC4899',
  'Klient X – meetings': '#8B5CF6',
  'Urlop': '#10B981',
  'Chorobowe': '#F43F5E',
  'Rekrutacja': '#6366F1',
  'Marketing': '#F59E0B',
  'Mentoring': '#06B6D4'
};

const CATEGORY_COLORS = {
  'Komercyjne': '#3B82F6',
  'Nieobecności': '#F43F5E',
  'Wewnętrzne': '#F59E0B',
  'Inne': '#64748B'
};

const DYNAMIC_PALETTE = [
  '#3B82F6', '#EC4899', '#8B5CF6', '#10B981', '#F43F5E', 
  '#F59E0B', '#06B6D4', '#6366F1', '#14B8A6', '#84CC16',
  '#E11D48', '#D946EF', '#0EA5E9', '#F97316', '#A855F7'
];

const DATE_PRESET_RANGES = {
  'all': null,
  'w1': { start: '2025-11-03', end: '2025-11-07' },
  'w2': { start: '2025-11-10', end: '2025-11-14' },
  'w3': { start: '2025-11-17', end: '2025-11-21' },
  'w4': { start: '2025-11-24', end: '2025-11-28' }
};

// Application State
let appData = typeof DEFAULT_REPORT_DATA !== 'undefined' ? [...DEFAULT_REPORT_DATA] : [];
let selectedWorkers = new Set();
let selectedTasks = new Set();
let searchQuery = '';
let activeDatePreset = 'all';
let customDateFilter = null; // optional single date toggle from timeline chart
let timelineBreakdownMode = 'tasks'; // 'tasks' | 'categories' | 'workers'

let sortField = 'data';
let sortAsc = true;
let currentPage = 1;
let pageSize = 20;

// Chart Instances
let donutChartInstance = null;
let workersBarChartInstance = null;
let timelineChartInstance = null;

// Helpers
function getCategory(taskName) {
  if (!taskName) return 'Inne';
  if (taskName.startsWith('Klient X')) return 'Komercyjne';
  if (['Urlop', 'Chorobowe'].includes(taskName)) return 'Nieobecności';
  return 'Wewnętrzne';
}

function getCategoryClass(category) {
  if (category === 'Komercyjne') return 'cat-client';
  if (category === 'Nieobecności') return 'cat-absence';
  return 'cat-internal';
}

function getCategoryColor(category) {
  return CATEGORY_COLORS[category] || '#64748B';
}

function getWorkerColor(worker) {
  return WORKER_COLORS[worker] || '#64748B';
}

function getTaskColor(task) {
  if (TASK_COLORS[task]) return TASK_COLORS[task];
  let hash = 0;
  for (let i = 0; i < task.length; i++) {
    hash = task.charCodeAt(i) + ((hash << 5) - hash);
  }
  const index = Math.abs(hash) % DYNAMIC_PALETTE.length;
  return DYNAMIC_PALETTE[index];
}

function hexToRgba(hex, alpha = 1) {
  let c = (hex || '#6366F1').replace('#', '');
  if (c.length === 3) {
    c = c.split('').map(x => x + x).join('');
  }
  const num = parseInt(c, 16);
  const r = (num >> 16) & 255;
  const g = (num >> 8) & 255;
  const b = num & 255;
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

function formatPolishDate(dateStr) {
  if (!dateStr) return '';
  const parts = dateStr.split('-');
  if (parts.length !== 3) return dateStr;
  const year = parseInt(parts[0], 10);
  const month = parseInt(parts[1], 10) - 1;
  const day = parseInt(parts[2], 10);
  const dateObj = new Date(year, month, day);
  
  const dayNames = ['Niedziela', 'Poniedziałek', 'Wtorek', 'Środa', 'Czwartek', 'Piątek', 'Sobota'];
  const monthNames = ['stycznia', 'lutego', 'marca', 'kwietnia', 'maja', 'czerwca', 'lipca', 'sierpnia', 'września', 'października', 'listopada', 'grudnia'];
  
  const dayOfWeek = dayNames[dateObj.getDay()];
  const monthName = monthNames[month];
  return `${dayOfWeek}, ${day} ${monthName} ${year}`;
}

function formatShortDateWithDay(dateStr) {
  if (!dateStr) return '';
  const parts = dateStr.split('-');
  if (parts.length !== 3) return dateStr;
  const year = parseInt(parts[0], 10);
  const month = parseInt(parts[1], 10) - 1;
  const day = parseInt(parts[2], 10);
  const dateObj = new Date(year, month, day);
  
  const shortDays = ['Nd', 'Pn', 'Wt', 'Śr', 'Cz', 'Pt', 'Sb'];
  const dayShort = shortDays[dateObj.getDay()];
  return `${parts[2]}.${parts[1]} (${dayShort})`;
}

// Initializer
document.addEventListener('DOMContentLoaded', () => {
  initTheme();
  initFilters();
  initEventListeners();
  renderApp();
});

// Theme Toggle
function initTheme() {
  const savedTheme = localStorage.getItem('timemetrics_theme') || 'dark';
  document.documentElement.setAttribute('data-theme', savedTheme);
  updateThemeIcon(savedTheme);
}

function toggleTheme() {
  const current = document.documentElement.getAttribute('data-theme') || 'dark';
  const next = current === 'dark' ? 'light' : 'dark';
  document.documentElement.setAttribute('data-theme', next);
  localStorage.setItem('timemetrics_theme', next);
  updateThemeIcon(next);
  updateChartsTheme();
}

function updateThemeIcon(theme) {
  const icon = document.getElementById('theme-icon');
  if (!icon) return;
  if (theme === 'light') {
    icon.className = 'fa-solid fa-moon';
  } else {
    icon.className = 'fa-solid fa-sun';
  }
}

// Filter Initialization
function initFilters() {
  const allWorkers = [...new Set(appData.map(d => d.pracownik))].sort();
  const allTasks = [...new Set(appData.map(d => d.zadanie))].sort();

  selectedWorkers = new Set(allWorkers);
  selectedTasks = new Set(allTasks);

  renderFilterControls();
}

function renderFilterControls() {
  const allWorkers = [...new Set(appData.map(d => d.pracownik))].sort();
  const allTasks = [...new Set(appData.map(d => d.zadanie))].sort();

  // Workers
  const workersContainer = document.getElementById('workers-filter-container');
  workersContainer.innerHTML = '';

  allWorkers.forEach(worker => {
    const isSelected = selectedWorkers.has(worker);
    const workerHours = appData.filter(d => d.pracownik === worker).reduce((s, d) => s + d.godziny, 0);
    const color = getWorkerColor(worker);

    const chip = document.createElement('div');
    chip.className = `worker-chip ${isSelected ? 'active' : 'inactive'}`;
    chip.style.setProperty('--chip-color', color);
    chip.style.setProperty('--chip-glow', color + '44');
    chip.innerHTML = `
      <div class="worker-avatar">${worker.charAt(0)}</div>
      <span>${worker}</span>
      <span class="worker-hours">${workerHours.toFixed(1)}h</span>
    `;

    chip.addEventListener('click', () => {
      if (selectedWorkers.has(worker)) {
        selectedWorkers.delete(worker);
      } else {
        selectedWorkers.add(worker);
      }
      renderFilterControls();
      renderApp();
    });

    workersContainer.appendChild(chip);
  });

  // Tasks
  const tasksContainer = document.getElementById('tasks-filter-container');
  tasksContainer.innerHTML = '';

  allTasks.forEach(task => {
    const isSelected = selectedTasks.has(task);
    const color = getTaskColor(task);

    const chip = document.createElement('div');
    chip.className = `task-chip ${isSelected ? 'active' : 'inactive'}`;
    chip.style.setProperty('--task-color', color);
    chip.style.setProperty('--task-bg', color + '22');
    chip.innerHTML = `
      <span class="task-dot"></span>
      <span>${task}</span>
    `;

    chip.addEventListener('click', () => {
      if (selectedTasks.has(task)) {
        selectedTasks.delete(task);
      } else {
        selectedTasks.add(task);
      }
      renderFilterControls();
      renderApp();
    });

    tasksContainer.appendChild(chip);
  });
}

// Event Listeners
function initEventListeners() {
  // Theme toggle
  document.getElementById('theme-toggle-btn').addEventListener('click', toggleTheme);

  // Workers quick actions
  document.getElementById('select-all-workers-btn').addEventListener('click', () => {
    const all = [...new Set(appData.map(d => d.pracownik))];
    selectedWorkers = new Set(all);
    renderFilterControls();
    renderApp();
  });

  document.getElementById('deselect-all-workers-btn').addEventListener('click', () => {
    selectedWorkers.clear();
    renderFilterControls();
    renderApp();
  });

  // Tasks quick actions
  document.getElementById('select-all-tasks-btn').addEventListener('click', () => {
    const all = [...new Set(appData.map(d => d.zadanie))];
    selectedTasks = new Set(all);
    renderFilterControls();
    renderApp();
  });

  document.getElementById('deselect-all-tasks-btn').addEventListener('click', () => {
    selectedTasks.clear();
    renderFilterControls();
    renderApp();
  });

  // Search input
  const searchInput = document.getElementById('task-search-input');
  const clearSearchBtn = document.getElementById('clear-search-btn');

  searchInput.addEventListener('input', (e) => {
    searchQuery = e.target.value.trim().toLowerCase();
    clearSearchBtn.style.display = searchQuery ? 'block' : 'none';
    currentPage = 1;
    renderApp();
  });

  clearSearchBtn.addEventListener('click', () => {
    searchInput.value = '';
    searchQuery = '';
    clearSearchBtn.style.display = 'none';
    currentPage = 1;
    renderApp();
  });

  // Date Presets
  const presetBtns = document.querySelectorAll('.date-preset-btn');
  presetBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      presetBtns.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      activeDatePreset = btn.dataset.preset;
      customDateFilter = null;
      currentPage = 1;
      renderApp();
    });
  });

  // Reset Filters
  document.getElementById('reset-filters-btn').addEventListener('click', () => {
    const allWorkers = [...new Set(appData.map(d => d.pracownik))];
    const allTasks = [...new Set(appData.map(d => d.zadanie))];
    selectedWorkers = new Set(allWorkers);
    selectedTasks = new Set(allTasks);
    searchQuery = '';
    searchInput.value = '';
    clearSearchBtn.style.display = 'none';
    activeDatePreset = 'all';
    customDateFilter = null;
    timelineBreakdownMode = 'tasks';
    document.querySelectorAll('#timeline-mode-selector .seg-btn').forEach(b => b.classList.toggle('active', b.dataset.mode === 'tasks'));
    presetBtns.forEach(b => b.classList.toggle('active', b.dataset.preset === 'all'));
    currentPage = 1;
    renderFilterControls();
    renderApp();
  });

  // Timeline Breakdown Mode Selector
  const modeBtns = document.querySelectorAll('#timeline-mode-selector .seg-btn');
  modeBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      modeBtns.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      timelineBreakdownMode = btn.dataset.mode;
      renderCharts(getFilteredData());
    });
  });

  // Clear timeline date filter badge
  const clearTimelineBtn = document.getElementById('clear-timeline-date-btn');
  if (clearTimelineBtn) {
    clearTimelineBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      customDateFilter = null;
      currentPage = 1;
      renderApp();
    });
  }

  // Tabs Navigation
  const tabBtns = document.querySelectorAll('.tab-btn');
  tabBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      tabBtns.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');

      const targetTabId = btn.dataset.tab;
      document.querySelectorAll('.tab-pane').forEach(p => p.classList.remove('active'));
      document.getElementById(targetTabId).classList.add('active');
    });
  });

  // Table Sort & Pagination
  document.querySelectorAll('.data-table th[data-sort]').forEach(th => {
    th.addEventListener('click', () => {
      const field = th.dataset.sort;
      if (sortField === field) {
        sortAsc = !sortAsc;
      } else {
        sortField = field;
        sortAsc = true;
      }
      renderTable(getFilteredData());
    });
  });

  document.getElementById('table-page-size').addEventListener('change', (e) => {
    pageSize = parseInt(e.target.value, 10);
    currentPage = 1;
    renderTable(getFilteredData());
  });

  document.getElementById('prev-page-btn').addEventListener('click', () => {
    if (currentPage > 1) {
      currentPage--;
      renderTable(getFilteredData());
    }
  });

  document.getElementById('next-page-btn').addEventListener('click', () => {
    const filtered = getFilteredData();
    const totalPages = Math.ceil(filtered.length / pageSize) || 1;
    if (currentPage < totalPages) {
      currentPage++;
      renderTable(filtered);
    }
  });

  // Export CSV
  document.getElementById('export-csv-btn').addEventListener('click', exportToCSV);

  // Upload Modal Handlers
  initUploadModal();
}

function initUploadModal() {
  const modal = document.getElementById('upload-modal');
  const openBtn = document.getElementById('upload-json-btn');
  const closeBtn = document.getElementById('close-modal-btn');
  const cancelBtn = document.getElementById('cancel-modal-btn');
  const dropzone = document.getElementById('json-dropzone');
  const fileInput = document.getElementById('json-file-input');
  const restoreBtn = document.getElementById('restore-default-data-btn');

  openBtn.addEventListener('click', () => modal.classList.add('open'));
  const closeModal = () => modal.classList.remove('open');
  closeBtn.addEventListener('click', closeModal);
  cancelBtn.addEventListener('click', closeModal);

  // Drag and drop
  dropzone.addEventListener('dragover', (e) => {
    e.preventDefault();
    dropzone.classList.add('dragover');
  });

  dropzone.addEventListener('dragleave', () => dropzone.classList.remove('dragover'));

  dropzone.addEventListener('drop', (e) => {
    e.preventDefault();
    dropzone.classList.remove('dragover');
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFileUpload(e.dataTransfer.files[0]);
    }
  });

  fileInput.addEventListener('change', (e) => {
    if (e.target.files && e.target.files[0]) {
      handleFileUpload(e.target.files[0]);
    }
  });

  restoreBtn.addEventListener('click', () => {
    if (typeof DEFAULT_REPORT_DATA !== 'undefined') {
      appData = [...DEFAULT_REPORT_DATA];
      initFilters();
      renderApp();
      closeModal();
    }
  });
}

function handleFileUpload(file) {
  const reader = new FileReader();
  reader.onload = (e) => {
    try {
      const parsed = JSON.parse(e.target.result);
      if (Array.isArray(parsed) && parsed.length > 0 && parsed[0].data && parsed[0].pracownik && parsed[0].zadanie) {
        appData = parsed;
        initFilters();
        renderApp();
        document.getElementById('upload-modal').classList.remove('open');
      } else {
        alert('Plik JSON musi zawierać tablicę obiektów z polami: data, pracownik, zadanie, godziny.');
      }
    } catch (err) {
      alert('Błąd podczas parsowania pliku JSON: ' + err.message);
    }
  };
  reader.readAsText(file);
}

// Data Filtering Engine
function getFilteredData(ignoreCustomDate = false) {
  return appData.filter(item => {
    // Worker filter
    if (selectedWorkers.size > 0 && !selectedWorkers.has(item.pracownik)) return false;

    // Task filter
    if (selectedTasks.size > 0 && !selectedTasks.has(item.zadanie)) return false;

    // Single custom date filter (from timeline chart click)
    if (!ignoreCustomDate && customDateFilter && item.data !== customDateFilter) return false;

    // Date Presets
    const range = DATE_PRESET_RANGES[activeDatePreset];
    if (range) {
      if (item.data < range.start || item.data > range.end) return false;
    }

    // Search Query
    if (searchQuery) {
      const searchContent = `${item.pracownik} ${item.zadanie} ${item.data} ${getCategory(item.zadanie)}`.toLowerCase();
      if (!searchContent.includes(searchQuery)) return false;
    }

    return true;
  });
}

// Main Render Dispatcher
function renderApp() {
  const filtered = getFilteredData();
  renderKPIs(filtered);
  renderCharts(filtered);
  renderTeamCards(filtered);
  renderActivityMatrix(filtered);
  renderTable(filtered);
}

// Render KPIs
function renderKPIs(filtered) {
  const totalReportHours = appData.reduce((s, d) => s + d.godziny, 0);
  const totalFilteredHours = filtered.reduce((s, d) => s + d.godziny, 0);

  const clientHours = filtered.filter(d => d.zadanie.startsWith('Klient X')).reduce((s, d) => s + d.godziny, 0);
  const vacationHours = filtered.filter(d => d.zadanie === 'Urlop').reduce((s, d) => s + d.godziny, 0);
  const sickHours = filtered.filter(d => d.zadanie === 'Chorobowe').reduce((s, d) => s + d.godziny, 0);
  const absenceHours = vacationHours + sickHours;
  const internalHours = totalFilteredHours - clientHours - absenceHours;

  const distinctDays = [...new Set(filtered.map(d => d.data))];
  const distinctWorkers = [...new Set(filtered.map(d => d.pracownik))];
  const dailyAvg = distinctDays.length > 0 ? (totalFilteredHours / distinctDays.length) : 0;

  // Total Hours Card
  document.getElementById('kpi-total-hours').innerHTML = `${totalFilteredHours.toFixed(1)} <span class="unit">h</span>`;
  const totalPercent = totalReportHours > 0 ? ((totalFilteredHours / totalReportHours) * 100).toFixed(1) : '0.0';
  document.getElementById('kpi-total-percent').textContent = `${totalPercent}% bazy`;
  document.getElementById('kpi-active-entries').textContent = `${filtered.length} wpisów`;

  // Client X Card
  document.getElementById('kpi-client-hours').innerHTML = `${clientHours.toFixed(1)} <span class="unit">h</span>`;
  const clientPercent = totalFilteredHours > 0 ? ((clientHours / totalFilteredHours) * 100).toFixed(1) : '0.0';
  document.getElementById('kpi-client-percent').textContent = `${clientPercent}% billable`;

  // Absence Card
  document.getElementById('kpi-absence-hours').innerHTML = `${absenceHours.toFixed(1)} <span class="unit">h</span>`;
  const absencePercent = totalFilteredHours > 0 ? ((absenceHours / totalFilteredHours) * 100).toFixed(1) : '0.0';
  document.getElementById('kpi-absence-percent').textContent = `${absencePercent}% czasu`;
  document.getElementById('kpi-absence-details').textContent = `${vacationHours.toFixed(1)}h Urlop | ${sickHours.toFixed(1)}h L4`;

  // Internal Card
  document.getElementById('kpi-internal-hours').innerHTML = `${internalHours.toFixed(1)} <span class="unit">h</span>`;
  const internalPercent = totalFilteredHours > 0 ? ((internalHours / totalFilteredHours) * 100).toFixed(1) : '0.0';
  document.getElementById('kpi-internal-percent').textContent = `${internalPercent}% czasu`;

  // Daily Avg Card
  document.getElementById('kpi-daily-avg').innerHTML = `${dailyAvg.toFixed(1)} <span class="unit">h/dzień</span>`;
  document.getElementById('kpi-active-days').textContent = `${distinctDays.length} dni roboczych`;
  document.getElementById('kpi-active-workers-count').textContent = `${distinctWorkers.length} os. aktywnych`;

  document.getElementById('donut-total-badge').textContent = `${totalFilteredHours.toFixed(1)}h łącznie`;
}

// Charts
function renderCharts(filtered) {
  const isDark = (document.documentElement.getAttribute('data-theme') || 'dark') === 'dark';
  const textColor = isDark ? '#94A3B8' : '#475569';
  const gridColor = isDark ? 'rgba(255, 255, 255, 0.06)' : 'rgba(0, 0, 0, 0.06)';

  // Chart 1: Donut breakdown by Task
  const taskTotals = {};
  filtered.forEach(d => {
    taskTotals[d.zadanie] = (taskTotals[d.zadanie] || 0) + d.godziny;
  });

  const donutLabels = Object.keys(taskTotals);
  const donutData = Object.values(taskTotals);
  const donutColors = donutLabels.map(t => getTaskColor(t));

  const donutCtx = document.getElementById('tasksDonutChart').getContext('2d');
  if (donutChartInstance) donutChartInstance.destroy();

  donutChartInstance = new Chart(donutCtx, {
    type: 'doughnut',
    data: {
      labels: donutLabels,
      datasets: [{
        data: donutData,
        backgroundColor: donutColors,
        borderWidth: 2,
        borderColor: isDark ? '#111827' : '#FFFFFF',
        hoverOffset: 6
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      cutout: '68%',
      plugins: {
        legend: {
          position: 'right',
          labels: {
            color: textColor,
            font: { family: 'Plus Jakarta Sans', size: 11 },
            boxWidth: 12,
            padding: 8
          }
        },
        tooltip: {
          callbacks: {
            label: (ctx) => ` ${ctx.label}: ${ctx.raw.toFixed(1)}h (${((ctx.raw / (filtered.reduce((s,d)=>s+d.godziny,0) || 1))*100).toFixed(1)}%)`
          }
        }
      }
    }
  });

  // Chart 2: Workers Stacked Bar
  const workers = [...new Set(filtered.map(d => d.pracownik))].sort();
  const allTasks = [...new Set(filtered.map(d => d.zadanie))].sort();

  const datasets = allTasks.map(task => {
    const data = workers.map(worker => {
      return filtered
        .filter(d => d.pracownik === worker && d.zadanie === task)
        .reduce((s, d) => s + d.godziny, 0);
    });

    return {
      label: task,
      data: data,
      backgroundColor: getTaskColor(task),
      borderRadius: 4
    };
  });

  const barCtx = document.getElementById('workersBarChart').getContext('2d');
  if (workersBarChartInstance) workersBarChartInstance.destroy();

  workersBarChartInstance = new Chart(barCtx, {
    type: 'bar',
    data: {
      labels: workers,
      datasets: datasets
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      scales: {
        x: {
          stacked: true,
          grid: { display: false },
          ticks: { color: textColor, font: { family: 'Plus Jakarta Sans', weight: '600' } }
        },
        y: {
          stacked: true,
          grid: { color: gridColor },
          ticks: { color: textColor, callback: (v) => v + 'h' }
        }
      },
      plugins: {
        legend: { display: false },
        tooltip: {
          callbacks: {
            label: (ctx) => ` ${ctx.dataset.label}: ${ctx.raw.toFixed(1)}h`
          }
        }
      }
    }
  });

  // Chart 3: Timeline Trend with Breakdown
  const baseFiltered = getFilteredData(true);
  const allDates = [...new Set(baseFiltered.map(d => d.data))].sort();

  // Compute total hours per date (for percentage and day sum calculation)
  const dayTotalsMap = {};
  allDates.forEach(date => {
    dayTotalsMap[date] = baseFiltered.filter(d => d.data === date).reduce((s, d) => s + d.godziny, 0);
  });

  let timelineDatasets = [];

  if (timelineBreakdownMode === 'tasks') {
    // Group by Task
    const tasksInView = [...new Set(baseFiltered.map(d => d.zadanie))].sort();

    timelineDatasets = tasksInView.map(task => {
      const baseColor = getTaskColor(task);
      const data = allDates.map(date => {
        return baseFiltered
          .filter(d => d.data === date && d.zadanie === task)
          .reduce((s, d) => s + d.godziny, 0);
      });

      const bgColors = allDates.map(date => {
        if (!customDateFilter) return baseColor;
        return date === customDateFilter ? baseColor : hexToRgba(baseColor, 0.22);
      });

      const borderColors = allDates.map(date => {
        if (date === customDateFilter) return isDark ? '#FFFFFF' : '#0F172A';
        return 'transparent';
      });

      const borderWidths = allDates.map(date => {
        return date === customDateFilter ? 1.5 : 0;
      });

      return {
        label: task,
        data: data,
        backgroundColor: bgColors,
        borderColor: borderColors,
        borderWidth: borderWidths,
        borderRadius: 4,
        stack: 'daily-timeline-stack'
      };
    });
  } else if (timelineBreakdownMode === 'categories') {
    // Group by Category
    const allCatList = ['Komercyjne', 'Wewnętrzne', 'Nieobecności'];
    const categoriesInView = allCatList.filter(cat => baseFiltered.some(d => getCategory(d.zadanie) === cat));

    timelineDatasets = categoriesInView.map(category => {
      const baseColor = getCategoryColor(category);
      const data = allDates.map(date => {
        return baseFiltered
          .filter(d => d.data === date && getCategory(d.zadanie) === category)
          .reduce((s, d) => s + d.godziny, 0);
      });

      const bgColors = allDates.map(date => {
        if (!customDateFilter) return baseColor;
        return date === customDateFilter ? baseColor : hexToRgba(baseColor, 0.22);
      });

      const borderColors = allDates.map(date => {
        if (date === customDateFilter) return isDark ? '#FFFFFF' : '#0F172A';
        return 'transparent';
      });

      const borderWidths = allDates.map(date => {
        return date === customDateFilter ? 1.5 : 0;
      });

      return {
        label: category,
        data: data,
        backgroundColor: bgColors,
        borderColor: borderColors,
        borderWidth: borderWidths,
        borderRadius: 4,
        stack: 'daily-timeline-stack'
      };
    });
  } else {
    // Group by Worker
    const workersInView = [...new Set(baseFiltered.map(d => d.pracownik))].sort();

    timelineDatasets = workersInView.map(worker => {
      const baseColor = getWorkerColor(worker);
      const data = allDates.map(date => {
        return baseFiltered
          .filter(d => d.data === date && d.pracownik === worker)
          .reduce((s, d) => s + d.godziny, 0);
      });

      const bgColors = allDates.map(date => {
        if (!customDateFilter) return baseColor;
        return date === customDateFilter ? baseColor : hexToRgba(baseColor, 0.22);
      });

      const borderColors = allDates.map(date => {
        if (date === customDateFilter) return isDark ? '#FFFFFF' : '#0F172A';
        return 'transparent';
      });

      const borderWidths = allDates.map(date => {
        return date === customDateFilter ? 1.5 : 0;
      });

      return {
        label: worker,
        data: data,
        backgroundColor: bgColors,
        borderColor: borderColors,
        borderWidth: borderWidths,
        borderRadius: 4,
        stack: 'daily-timeline-stack'
      };
    });
  }

  // Update UI badge for active single-date filter
  const filterBadge = document.getElementById('timeline-active-filter-badge');
  const filterDateVal = document.getElementById('timeline-filter-date-val');
  if (filterBadge && filterDateVal) {
    if (customDateFilter) {
      filterBadge.style.display = 'inline-flex';
      filterDateVal.textContent = customDateFilter;
    } else {
      filterBadge.style.display = 'none';
    }
  }

  const timelineCtx = document.getElementById('timelineTrendChart').getContext('2d');
  if (timelineChartInstance) timelineChartInstance.destroy();

  timelineChartInstance = new Chart(timelineCtx, {
    type: 'bar',
    data: {
      labels: allDates.map(d => formatShortDateWithDay(d)),
      datasets: timelineDatasets
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      onClick: (e, elements) => {
        if (elements.length > 0) {
          const index = elements[0].index;
          const clickedDate = allDates[index];
          if (customDateFilter === clickedDate) {
            customDateFilter = null;
          } else {
            customDateFilter = clickedDate;
          }
          currentPage = 1;
          renderApp();
        }
      },
      scales: {
        x: {
          stacked: true,
          grid: { display: false },
          ticks: {
            color: textColor,
            font: { family: 'Plus Jakarta Sans', size: 10, weight: '500' }
          }
        },
        y: {
          stacked: true,
          grid: { color: gridColor },
          ticks: {
            color: textColor,
            callback: (v) => v + 'h'
          }
        }
      },
      plugins: {
        legend: {
          display: true,
          position: 'bottom',
          labels: {
            color: textColor,
            font: { family: 'Plus Jakarta Sans', size: 11 },
            boxWidth: 10,
            boxHeight: 10,
            usePointStyle: true,
            pointStyle: 'circle',
            padding: 10
          }
        },
        tooltip: {
          mode: 'index',
          intersect: false,
          backgroundColor: isDark ? 'rgba(17, 24, 39, 0.95)' : 'rgba(255, 255, 255, 0.95)',
          titleColor: isDark ? '#F8FAFC' : '#0F172A',
          bodyColor: isDark ? '#94A3B8' : '#475569',
          borderColor: isDark ? 'rgba(255, 255, 255, 0.12)' : 'rgba(0, 0, 0, 0.12)',
          borderWidth: 1,
          padding: 10,
          boxPadding: 4,
          usePointStyle: true,
          filter: (tooltipItem) => tooltipItem.raw > 0,
          callbacks: {
            title: (items) => {
              if (!items || items.length === 0) return '';
              const dateStr = allDates[items[0].dataIndex];
              return formatPolishDate(dateStr);
            },
            label: (ctx) => {
              const val = ctx.raw || 0;
              const dateStr = allDates[ctx.dataIndex];
              const dayTotal = dayTotalsMap[dateStr] || 0;
              const pct = dayTotal > 0 ? ((val / dayTotal) * 100).toFixed(0) : 0;
              return ` ${ctx.dataset.label}: ${val.toFixed(1)}h (${pct}%)`;
            },
            footer: (tooltipItems) => {
              if (!tooltipItems || tooltipItems.length === 0) return '';
              const dateStr = allDates[tooltipItems[0].dataIndex];
              const total = dayTotalsMap[dateStr] || 0;
              const isFiltered = customDateFilter === dateStr;
              return `\nŁącznie: ${total.toFixed(1)}h\n${isFiltered ? '● Dzień aktywny (kliknij, aby odznaczyć)' : '👉 Kliknij słupek, aby filtrować ten dzień'}`;
            }
          }
        }
      }
    }
  });
}

function updateChartsTheme() {
  if (donutChartInstance || workersBarChartInstance || timelineChartInstance) {
    renderCharts(getFilteredData());
  }
}

// Tab 1: Team Cards View
function renderTeamCards(filtered) {
  const container = document.getElementById('team-cards-container');
  container.innerHTML = '';

  const allWorkers = ['Bartek', 'Darek', 'Kamil', 'Alicja'];

  allWorkers.forEach(worker => {
    const workerRecords = filtered.filter(d => d.pracownik === worker);
    const totalHours = workerRecords.reduce((s, d) => s + d.godziny, 0);
    const color = getWorkerColor(worker);

    // Group tasks
    const taskMap = {};
    workerRecords.forEach(d => {
      taskMap[d.zadanie] = (taskMap[d.zadanie] || 0) + d.godziny;
    });

    const sortedTasks = Object.entries(taskMap).sort((a, b) => b[1] - a[1]);

    const card = document.createElement('div');
    card.className = 'team-card';
    card.style.setProperty('--member-color', color);

    // Progress segment elements
    let progressBarsHtml = '';
    if (totalHours > 0) {
      progressBarsHtml = sortedTasks.map(([task, hours]) => {
        const pct = (hours / totalHours) * 100;
        return `<div class="progress-segment" style="width: ${pct}%; background: ${getTaskColor(task)};" title="${task}: ${hours.toFixed(1)}h (${pct.toFixed(0)}%)"></div>`;
      }).join('');
    } else {
      progressBarsHtml = `<div class="progress-segment" style="width: 100%; background: var(--border-color);"></div>`;
    }

    // Task rows html
    let taskListHtml = '';
    if (sortedTasks.length > 0) {
      taskListHtml = sortedTasks.map(([task, hours]) => {
        const pct = totalHours > 0 ? (hours / totalHours) * 100 : 0;
        return `
          <div class="team-task-row">
            <span class="team-task-name">
              <span class="task-dot" style="background: ${getTaskColor(task)};"></span>
              ${task}
            </span>
            <span class="team-task-hours">${hours.toFixed(1)}h <span style="font-size: 10px; color: var(--text-muted); font-weight: normal;">(${pct.toFixed(0)}%)</span></span>
          </div>
        `;
      }).join('');
    } else {
      taskListHtml = `<div style="font-size: 12px; color: var(--text-muted); padding: 12px 0;">Brak wpisów dla wybranych filtrów.</div>`;
    }

    card.innerHTML = `
      <div class="team-card-header">
        <div class="team-avatar-lg">${worker.charAt(0)}</div>
        <div class="team-card-info">
          <h3>${worker}</h3>
          <p>${worker === 'Alicja' ? 'UI/UX Designer' : worker === 'Bartek' ? 'Lead Dev & Tech' : 'Software Developer'}</p>
        </div>
      </div>

      <div class="team-stat-row">
        <span style="font-size: 13px; color: var(--text-secondary);">Zaraportowane godziny</span>
        <span class="team-stat-val">${totalHours.toFixed(1)} <span style="font-size: 13px; font-weight: normal; color: var(--text-muted);">h</span></span>
      </div>

      <div class="team-progress-bar">
        ${progressBarsHtml}
      </div>

      <div class="team-tasks-breakdown">
        ${taskListHtml}
      </div>

      <div class="team-card-footer">
        <button class="btn btn-secondary" style="font-size: 11px; padding: 4px 10px;" onclick="isolateWorker('${worker}')">
          <i class="fa-solid fa-filter"></i> Tylko ${worker}
        </button>
      </div>
    `;

    container.appendChild(card);
  });
}

window.isolateWorker = function(worker) {
  selectedWorkers = new Set([worker]);
  renderFilterControls();
  renderApp();
};

// Tab 2: Activity Matrix (Heatmap)
function renderActivityMatrix(filtered) {
  const table = document.getElementById('activity-matrix-table');
  table.innerHTML = '';

  const allDates = [...new Set(appData.map(d => d.data))].sort();
  const allWorkers = ['Bartek', 'Darek', 'Kamil', 'Alicja'];

  // Header row (Dates)
  const thead = document.createElement('thead');
  const headerRow = document.createElement('tr');
  
  const workerTh = document.createElement('th');
  workerTh.className = 'sticky-col';
  workerTh.textContent = 'Pracownik / Dzień';
  headerRow.appendChild(workerTh);

  allDates.forEach(date => {
    const th = document.createElement('th');
    th.textContent = date.slice(8); // Day only (03, 04, 05...)
    th.title = date;
    headerRow.appendChild(th);
  });

  const sumTh = document.createElement('th');
  sumTh.textContent = 'Suma';
  headerRow.appendChild(sumTh);

  thead.appendChild(headerRow);
  table.appendChild(thead);

  // Body rows per worker
  const tbody = document.createElement('tbody');

  allWorkers.forEach(worker => {
    const row = document.createElement('tr');

    const nameTd = document.createElement('td');
    nameTd.className = 'sticky-col';
    nameTd.innerHTML = `
      <div style="display: flex; align-items: center; gap: 8px;">
        <span class="worker-avatar" style="--chip-color: ${getWorkerColor(worker)}">${worker.charAt(0)}</span>
        <span>${worker}</span>
      </div>
    `;
    row.appendChild(nameTd);

    let workerRowTotal = 0;

    allDates.forEach(date => {
      const td = document.createElement('td');
      const dayRecords = filtered.filter(d => d.pracownik === worker && d.data === date);

      if (dayRecords.length > 0) {
        const dayHours = dayRecords.reduce((s, d) => s + d.godziny, 0);
        workerRowTotal += dayHours;

        const mainTask = dayRecords[0].zadanie;
        let cellType = 'work';
        if (mainTask === 'Urlop') cellType = 'vacation';
        else if (mainTask === 'Chorobowe') cellType = 'sick';
        else if (mainTask.includes('design')) cellType = 'design';

        const taskDetails = dayRecords.map(r => `${r.zadanie}: ${r.godziny}h`).join('\n');

        td.innerHTML = `<span class="matrix-cell ${cellType}" title="${date} - ${worker}\n${taskDetails}">${dayHours}</span>`;
      } else {
        td.innerHTML = `<span class="matrix-cell empty">-</span>`;
      }

      row.appendChild(td);
    });

    // Sum col
    const totalTd = document.createElement('td');
    totalTd.style.fontWeight = '700';
    totalTd.textContent = `${workerRowTotal.toFixed(1)}h`;
    row.appendChild(totalTd);

    tbody.appendChild(row);
  });

  table.appendChild(tbody);
}

// Tab 3: Detailed Table
function renderTable(filtered) {
  // Sort data
  const sorted = [...filtered].sort((a, b) => {
    let valA = a[sortField];
    let valB = b[sortField];

    if (sortField === 'kategoria') {
      valA = getCategory(a.zadanie);
      valB = getCategory(b.zadanie);
    }

    if (typeof valA === 'string') {
      return sortAsc ? valA.localeCompare(valB) : valB.localeCompare(valA);
    }
    return sortAsc ? valA - valB : valB - valA;
  });

  // Update header indicators
  document.querySelectorAll('.data-table th[data-sort]').forEach(th => {
    th.classList.remove('sorted-asc', 'sorted-desc');
    if (th.dataset.sort === sortField) {
      th.classList.add(sortAsc ? 'sorted-asc' : 'sorted-desc');
    }
  });

  // Pagination calculation
  const totalRows = sorted.length;
  const totalPages = Math.ceil(totalRows / pageSize) || 1;
  if (currentPage > totalPages) currentPage = totalPages;
  if (currentPage < 1) currentPage = 1;

  const startIdx = (currentPage - 1) * pageSize;
  const pageRows = sorted.slice(startIdx, startIdx + pageSize);

  // Render Rows
  const tbody = document.getElementById('table-body');
  tbody.innerHTML = '';

  if (pageRows.length === 0) {
    tbody.innerHTML = `<tr><td colspan="5" style="text-align: center; color: var(--text-muted); padding: 32px;">Brak danych spełniających kryteria filtrów.</td></tr>`;
  } else {
    pageRows.forEach(item => {
      const tr = document.createElement('tr');
      const cat = getCategory(item.zadanie);
      const catClass = getCategoryClass(cat);
      const workerColor = getWorkerColor(item.pracownik);

      tr.innerHTML = `
        <td style="font-family: monospace; font-weight: 600;">${item.data}</td>
        <td>
          <span class="worker-chip active" style="--chip-color: ${workerColor}; --chip-glow: transparent; padding: 2px 8px; font-size: 12px;">
            <span class="worker-avatar" style="width: 18px; height: 18px; font-size: 9px;">${item.pracownik.charAt(0)}</span>
            ${item.pracownik}
          </span>
        </td>
        <td>
          <span style="display: inline-flex; align-items: center; gap: 6px;">
            <span class="task-dot" style="background: ${getTaskColor(item.zadanie)};"></span>
            <strong>${item.zadanie}</strong>
          </span>
        </td>
        <td><span class="tag-badge ${catClass}">${cat}</span></td>
        <td style="text-align: right; font-weight: 700; font-family: var(--font-heading); font-size: 14px;">${item.godziny.toFixed(1)} h</td>
      `;
      tbody.appendChild(tr);
    });
  }

  // Summary & pagination info
  document.getElementById('table-summary-text').innerHTML = `Wyświetlanie <strong>${pageRows.length > 0 ? startIdx + 1 : 0}–${Math.min(startIdx + pageSize, totalRows)}</strong> z <strong>${totalRows}</strong> wpisów`;
  document.getElementById('pagination-info').textContent = `Strona ${currentPage} z ${totalPages}`;
  document.getElementById('prev-page-btn').disabled = currentPage <= 1;
  document.getElementById('next-page-btn').disabled = currentPage >= totalPages;
}

// CSV Exporter
function exportToCSV() {
  const filtered = getFilteredData();
  if (filtered.length === 0) {
    alert('Brak danych do wyeksportowania!');
    return;
  }

  let csvContent = '\uFEFF'; // UTF-8 BOM for Excel
  csvContent += 'Data;Pracownik;Zadanie;Kategoria;Godziny\n';

  filtered.forEach(row => {
    const category = getCategory(row.zadanie);
    csvContent += `"${row.data}";"${row.pracownik}";"${row.zadanie}";"${category}";"${row.godziny}"\n`;
  });

  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.setAttribute('href', url);
  link.setAttribute('download', `raport_godzinowy_${new Date().toISOString().slice(0, 10)}.csv`);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}
