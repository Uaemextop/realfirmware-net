/**
 * main.js — Entry point for the RealFirmware File Explorer
 * Imports all modules and orchestrates the application
 */

// CSS imports (bundled by esbuild)
import 'normalize.css';
import 'notyf/notyf.min.css';
import 'highlight.js/styles/github-dark.css';
import 'tippy.js/dist/tippy.css';
import 'tippy.js/animations/shift-away.css';
import 'animate.css';

// Lazy-loading for images
import 'lazysizes';

// Application modules
import { initSearch, searchFiles } from './search.js';
import { populateFilters, applyFilters, renderFilterTags, clearAllFilters, getFilterState, setFilterState } from './filters.js';
import { downloadDirAsZip, downloadSelectedAsZip, fileDownloadUrl } from './download.js';
import { buildRows, sortEntries, renderTable, renderInfoPanel, dirStats } from './explorer.js';
import { isPreviewable, showPreview } from './preview.js';
import { initUI, applyTooltips, copyToClipboard, formatBytes, notifySuccess, notifyError } from './ui.js';

// Make notify functions globally available for preview.js
window.notifySuccess = notifySuccess;
window.notifyError = notifyError;

// dayjs for date formatting
import dayjs from 'dayjs';
import relativeTime from 'dayjs/plugin/relativeTime';
import 'dayjs/locale/es';
dayjs.extend(relativeTime);
dayjs.locale('es');

/* ── State ── */
let DATA = null;
let curPath = '';
let sortKey = 'name';
let sortAsc = true;
let searchMode = false;
let selectedFiles = new Set();
let viewMode = localStorage.getItem('viewMode') || 'comfortable';

const $ = s => document.querySelector(s);
const $$ = s => document.querySelectorAll(s);

/* ── URL Hash State ── */
function stateToHash() {
  const p = new URLSearchParams();
  if (curPath) p.set('p', curPath);
  const q = $('#searchInput');
  if (q && q.value) p.set('q', q.value);
  const fs = getFilterState();
  Object.entries(fs).forEach(([k, v]) => p.set(k, v));
  if (sortKey !== 'name') p.set('sort', sortKey);
  if (!sortAsc) p.set('dir', 'desc');
  return p.toString();
}

function hashToState() {
  const p = new URLSearchParams(location.hash.slice(1));
  curPath = p.get('p') || '';
  const q = $('#searchInput');
  if (q) q.value = p.get('q') || '';
  setFilterState({
    fCat: p.get('fCat') || '',
    fDev: p.get('fDev') || '',
    fIsp: p.get('fIsp') || '',
    fType: p.get('fType') || ''
  });
  sortKey = p.get('sort') || 'name';
  sortAsc = p.get('dir') !== 'desc';
  searchMode = !!(q && q.value);
}

function pushState() {
  history.pushState(null, '', '#' + stateToHash());
}

/* ── Navigation ── */
function nav(path) {
  curPath = path || '';
  searchMode = false;
  const q = $('#searchInput');
  if (q) q.value = '';
  pushState();
  render();
}

/* ── Breadcrumb ── */
function renderBreadcrumb() {
  const bc = $('#breadcrumb');
  if (!bc) return;
  const parts = curPath ? curPath.split('/') : [];
  let html = '<button data-nav="" title="Root">🏠 Root</button>';
  let acc = '';
  parts.forEach((p, i) => {
    html += '<span class="sep">/</span>';
    acc += (acc ? '/' : '') + p;
    if (i === parts.length - 1) html += `<span class="current">${p}</span>`;
    else html += `<button data-nav="${acc}">${p}</button>`;
  });
  bc.innerHTML = html;
  bc.querySelectorAll('button[data-nav]').forEach(b => {
    b.addEventListener('click', () => nav(b.dataset.nav));
  });
}

/* ── Progress UI ── */
function showProgress() { const o = $('#overlay'); if (o) o.classList.add('show'); }
function hideProgress() { const o = $('#overlay'); if (o) o.classList.remove('show'); }
function updateProgress(pct, msg) {
  const f = $('#oFill'), p = $('#oPct'), t = $('#oText');
  if (f) f.style.width = pct + '%';
  if (p) p.textContent = pct + '%';
  if (t) t.textContent = msg;
}

/* ── Main Render ── */
function render() {
  const q = $('#searchInput');
  const query = q ? q.value.trim() : '';
  searchMode = query.length > 0;

  const clearBtn = $('#clearSearch');
  if (clearBtn) clearBtn.classList.toggle('show', searchMode);

  // Update sort headers
  $$('.file-table th[data-sort]').forEach(th => {
    const k = th.dataset.sort;
    th.classList.toggle('active', k === sortKey);
    const arrow = th.querySelector('.arrow');
    if (arrow) arrow.textContent = k === sortKey ? (sortAsc ? '▲' : '▼') : '';
  });

  renderBreadcrumb();
  renderFilterTags($('#activeTags'), () => { pushState(); render(); });

  const filtered = applyFilters(DATA.files);

  if (searchMode) {
    // Search mode
    const results = searchFiles(query).filter(f => filtered.includes(f));
    const rows = results.map(f => ({ ...f, _dir: false }));
    const panel = $('#infoPanel');
    if (panel) panel.style.display = 'none';
    renderTable($('#fileList'), rows, true, tableCallbacks);
    applyTooltips($('#fileList'));
    return;
  }

  // Directory mode
  renderInfoPanel(filtered, curPath);
  const rows = buildRows(filtered, curPath);
  const sorted = sortEntries(rows, sortKey, sortAsc);
  renderTable($('#fileList'), sorted, false, tableCallbacks);
  applyTooltips($('#fileList'));
}

/* ── Table Callbacks ── */
const tableCallbacks = {
  onNav: (path) => nav(path),
  onZipDir: async (path) => {
    showProgress();
    await downloadDirAsZip(DATA.files, path, updateProgress, hideProgress);
  },
  onCopyLink: (link) => copyToClipboard(link),
  onPreview: (url, name, ext, fileData) => {
    const modal = $('#previewModal');
    if (modal) showPreview(url, name, ext, modal, fileData);
  },
  onFileSelect: (path, checked) => {
    if (checked) selectedFiles.add(path);
    else selectedFiles.delete(path);
    updateSelectionUI();
  }
};

/* ── Event Binding ── */
function bindEvents() {
  // Sort
  $$('.file-table th[data-sort]').forEach(th => {
    th.addEventListener('click', () => {
      const k = th.dataset.sort;
      if (sortKey === k) sortAsc = !sortAsc;
      else { sortKey = k; sortAsc = true; }
      pushState();
      render();
    });
  });

  // Search (debounced)
  let timer;
  const q = $('#searchInput');
  if (q) {
    q.addEventListener('input', () => {
      clearTimeout(timer);
      timer = setTimeout(() => { pushState(); render(); }, 200);
    });
  }
  const cb = $('#clearSearch');
  if (cb) cb.addEventListener('click', () => {
    if (q) q.value = '';
    searchMode = false;
    pushState();
    render();
  });

  // Filters
  ['#fCat','#fDev','#fIsp','#fType'].forEach(s => {
    const el = $(s);
    if (el) el.addEventListener('change', () => { pushState(); render(); });
  });
  const tf = $('#toggleFilters');
  if (tf) tf.addEventListener('click', () => $('#filterBar').classList.toggle('show'));
  const cf = $('#clearFilters');
  if (cf) cf.addEventListener('click', () => { clearAllFilters(); pushState(); render(); });

  // Download zip
  const dz = $('#dlZip');
  if (dz) dz.addEventListener('click', async () => {
    showProgress();
    await downloadDirAsZip(DATA.files, curPath || 'realfirmware', updateProgress, hideProgress);
  });

  // Info panel collapse/expand
  const ipt = $('#infoPanelToggle');
  if (ipt) ipt.addEventListener('click', () => {
    const panel = $('#infoPanel');
    if (panel) {
      panel.classList.toggle('collapsed');
      localStorage.setItem('infoPanelCollapsed', panel.classList.contains('collapsed'));
    }
  });
  // Restore collapse state
  if (localStorage.getItem('infoPanelCollapsed') === 'true') {
    const panel = $('#infoPanel');
    if (panel) panel.classList.add('collapsed');
  }

  // View mode toggle
  const vmt = $('#toggleViewMode');
  if (vmt) vmt.addEventListener('click', toggleViewMode);

  // Download selected
  const ds = $('#downloadSelected');
  if (ds) ds.addEventListener('click', downloadSelected);

  // Clear selection
  const cs = $('#clearSelection');
  if (cs) cs.addEventListener('click', clearSelection);

  // Close preview modal
  const mo = $('#previewOverlay');
  if (mo) {
    mo.addEventListener('click', e => { if (e.target === mo) mo.classList.remove('show'); });
    const close = mo.querySelector('.modal-close');
    if (close) close.addEventListener('click', () => mo.classList.remove('show'));

    // Fullscreen toggle
    const fst = $('#fullscreenToggle');
    if (fst) fst.addEventListener('click', () => {
      const modal = $('#previewModal');
      if (modal) {
        modal.classList.toggle('fullscreen');
        fst.textContent = modal.classList.contains('fullscreen') ? '🗗' : '⛶';
      }
    });
  }

  // Back/forward
  window.addEventListener('popstate', () => { hashToState(); render(); });

  // Keyboard shortcuts
  document.addEventListener('keydown', e => {
    // Focus search with /
    if (e.key === '/' && document.activeElement !== q) {
      e.preventDefault();
      if (q) q.focus();
    }
    // Escape key - clear search or close modal
    if (e.key === 'Escape') {
      if (q) q.blur();
      if (searchMode) { if (q) q.value = ''; searchMode = false; pushState(); render(); }
      const mo = $('#previewOverlay');
      if (mo && mo.classList.contains('show')) mo.classList.remove('show');
    }
    // Ctrl/Cmd + A - Select all files
    if ((e.ctrlKey || e.metaKey) && e.key === 'a' && !searchMode) {
      e.preventDefault();
      const checkboxes = $$('.file-checkbox:not([disabled])');
      const allChecked = Array.from(checkboxes).every(cb => cb.checked);
      checkboxes.forEach(cb => {
        cb.checked = !allChecked;
        const path = cb.dataset.path;
        if (cb.checked) selectedFiles.add(path);
        else selectedFiles.delete(path);
      });
      updateSelectionUI();
    }
    // Ctrl/Cmd + D - Download selected files
    if ((e.ctrlKey || e.metaKey) && e.key === 'd' && selectedFiles.size > 0) {
      e.preventDefault();
      downloadSelected();
    }
    // Ctrl/Cmd + K - Toggle compact view
    if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
      e.preventDefault();
      toggleViewMode();
    }
  });
}

/* ── Selection Management ── */
function updateSelectionUI() {
  const count = selectedFiles.size;
  const btn = $('#downloadSelected');
  const selectionBar = $('#selectionBar');

  if (count > 0) {
    if (selectionBar) {
      selectionBar.style.display = 'flex';
      const countEl = selectionBar.querySelector('.selection-count');
      if (countEl) countEl.textContent = `${count} file${count > 1 ? 's' : ''} selected`;
    }
  } else {
    if (selectionBar) selectionBar.style.display = 'none';
  }
}

function downloadSelected() {
  if (selectedFiles.size === 0) {
    notifyError('No files selected');
    return;
  }

  const filesToDownload = DATA.files.filter(f => selectedFiles.has(f.path));
  showProgress();
  downloadSelectedAsZip(filesToDownload, updateProgress, () => {
    hideProgress();
    notifySuccess(`Downloaded ${selectedFiles.size} files`);
    clearSelection();
  });
}

function clearSelection() {
  selectedFiles.clear();
  $$('.file-checkbox').forEach(cb => cb.checked = false);
  updateSelectionUI();
}

function toggleViewMode() {
  viewMode = viewMode === 'comfortable' ? 'compact' : 'comfortable';
  localStorage.setItem('viewMode', viewMode);
  document.body.setAttribute('data-view', viewMode);
  notifySuccess(`View mode: ${viewMode}`);
}

/* ── Init ── */
async function init() {
  initUI();

  // Apply view mode
  document.body.setAttribute('data-view', viewMode);

  try {
    const resp = await fetch('file-index.json');
    DATA = await resp.json();
  } catch (e) {
    const fl = $('#fileList');
    if (fl) fl.innerHTML = '<tr><td colspan="6" style="text-align:center;padding:40px;color:var(--text2)">Failed to load file-index.json</td></tr>';
    return;
  }

  initSearch(DATA.files);
  populateFilters(DATA);
  hashToState();
  bindEvents();
  render();
}

// Boot
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}

// Export for stats page
window.__FIRMWARE_DATA = () => DATA;
