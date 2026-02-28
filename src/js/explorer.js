/**
 * explorer.js — File explorer logic: navigation, sorting, rendering
 */
import { formatBytes } from './ui.js';

/* ── Helpers ── */
function esc(s) {
  return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

/* ── Icon SVGs ── */
const dirIcon = '<svg viewBox="0 0 24 24" class="ic-dir"><path d="M2 6a2 2 0 012-2h5l2 2h9a2 2 0 012 2v10a2 2 0 01-2 2H4a2 2 0 01-2-2V6z"/></svg>';
const fileIcon = c => `<svg viewBox="0 0 24 24" class="${c}"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8l-6-6z"/><polyline points="14 2 14 8 20 8" fill="none" stroke="currentColor" stroke-width="1"/></svg>`;
const dlSvg = '<svg viewBox="0 0 16 16"><path d="M7.47 10.78a.75.75 0 001.06 0l3.75-3.75a.75.75 0 00-1.06-1.06L8.75 8.44V1.75a.75.75 0 00-1.5 0v6.69L4.78 5.97a.75.75 0 00-1.06 1.06l3.75 3.75zM3.75 13a.75.75 0 000 1.5h8.5a.75.75 0 000-1.5h-8.5z"/></svg>';
const linkSvg = '<svg viewBox="0 0 16 16"><path d="M7.775 3.275a.75.75 0 001.06 1.06l1.25-1.25a2 2 0 112.83 2.83l-2.5 2.5a2 2 0 01-2.83 0 .75.75 0 00-1.06 1.06 3.5 3.5 0 004.95 0l2.5-2.5a3.5 3.5 0 00-4.95-4.95l-1.25 1.25zm-.025 5.475a.75.75 0 00-1.06 0l-1.25 1.25a2 2 0 11-2.83-2.83l2.5-2.5a2 2 0 012.83 0 .75.75 0 001.06-1.06 3.5 3.5 0 00-4.95 0l-2.5 2.5a3.5 3.5 0 004.95 4.95l1.25-1.25a.75.75 0 000-1.06z"/></svg>';
const eyeSvg = '<svg viewBox="0 0 16 16"><path d="M8 2c1.981 0 3.671.992 4.933 2.078 1.27 1.091 2.187 2.345 2.637 3.023a1.62 1.62 0 010 1.798c-.45.678-1.367 1.932-2.637 3.023C11.671 13.008 9.981 14 8 14s-3.671-.992-4.933-2.078C1.797 10.831.88 9.577.43 8.899a1.62 1.62 0 010-1.798c.45-.678 1.367-1.932 2.637-3.023C4.329 2.992 6.019 2 8 2zm0 10a4 4 0 100-8 4 4 0 000 8zm0-2a2 2 0 110-4 2 2 0 010 4z"/></svg>';

const ICON_MAP = {
  bin:'ic-fw',img:'ic-fw',txt:'ic-doc',docx:'ic-doc',log:'ic-doc',
  bat:'ic-exe',sh:'ic-exe',exe:'ic-exe',xml:'ic-cfg',cfg:'ic-cfg',ini:'ic-cfg',
  jpg:'ic-img',jpeg:'ic-img',png:'ic-img',webp:'ic-img',gif:'ic-img',mp4:'ic-vid'
};

function iconClass(ext) { return ICON_MAP[ext] || 'ic-file'; }
function getExt(name) { const i = name.lastIndexOf('.'); return i > 0 ? name.slice(i+1).toLowerCase() : ''; }

/**
 * Get directory entries (subdirectories + direct files) for a path
 */
export function getEntries(files, path) {
  const prefix = path ? path + '/' : '';
  const dirs = new Set();
  const direct = [];
  files.forEach(f => {
    if (!f.path.startsWith(prefix)) return;
    const rest = f.path.slice(prefix.length);
    const si = rest.indexOf('/');
    if (si >= 0) dirs.add(rest.slice(0, si));
    else direct.push(f);
  });
  return { dirs: [...dirs].sort(), files: direct };
}

/**
 * Get recursive stats for a directory
 */
export function dirStats(files, path) {
  const prefix = path ? path + '/' : '';
  let count = 0, size = 0;
  files.forEach(f => {
    if (f.path.startsWith(prefix)) { count++; size += f.size; }
  });
  return { count, size };
}

/**
 * Sort entries array
 */
export function sortEntries(entries, sortKey, sortAsc) {
  return entries.sort((a, b) => {
    if (a._parent) return -1;
    if (b._parent) return 1;
    if (a._dir !== b._dir) return a._dir ? -1 : 1;
    let cmp = 0;
    switch (sortKey) {
      case 'name': cmp = a.name.localeCompare(b.name, undefined, { numeric: true }); break;
      case 'size': cmp = (a.size || 0) - (b.size || 0); break;
      case 'type': cmp = (a.type || '').localeCompare(b.type || ''); break;
      case 'device': cmp = (a.device || '').localeCompare(b.device || ''); break;
      case 'modified': cmp = (a.modified || '').localeCompare(b.modified || ''); break;
    }
    return sortAsc ? cmp : -cmp;
  });
}

/**
 * Build rows array from entries
 */
export function buildRows(files, curPath) {
  const { dirs, files: direct } = getEntries(files, curPath);
  const rows = [];
  if (curPath) {
    rows.push({ _parent: true, _dir: true, name: '..', path: curPath.slice(0, curPath.lastIndexOf('/')) });
  }
  dirs.forEach(d => {
    const dp = (curPath ? curPath + '/' : '') + d;
    const s = dirStats(files, dp);
    rows.push({ _dir: true, name: d, path: dp, size: s.size, count: s.count });
  });
  direct.forEach(f => rows.push({ ...f, _dir: false }));
  return rows;
}

/**
 * Render the file table
 * @param {HTMLElement} tbody
 * @param {Array} rows
 * @param {boolean} isSearch
 * @param {Object} callbacks - { onNav, onZipDir, onCopyLink, onPreview }
 */
export function renderTable(tbody, rows, isSearch, callbacks) {
  const empty = document.getElementById('emptyState');
  if (!rows.length) {
    tbody.innerHTML = '';
    if (empty) empty.style.display = '';
    return;
  }
  if (empty) empty.style.display = 'none';

  const baseUrl = location.origin + location.pathname.replace(/[^/]*$/, '');
  let html = '';

  rows.forEach(r => {
    if (r._dir) {
      const label = r._parent ? '⬆ Parent directory' : esc(r.name);
      html += `<tr>
        <td><div class="fname">${dirIcon}<button data-nav="${esc(r.path)}">${label}</button></div></td>
        <td class="fsize col-size">${r._parent ? '' : (r.count + ' files · ' + formatBytes(r.size))}</td>
        <td class="col-type">${r._parent ? '' : '<span class="ftype">Folder</span>'}</td>
        <td class="col-cat"></td>
        <td class="col-mod">—</td>
        <td>${r._parent ? '' : '<div class="actions-cell"><button class="btn btn-sm btn-ghost zip-dir" data-path="'+esc(r.path)+'" data-tippy-content="Download as .zip">'+dlSvg+'</button></div>'}</td>
      </tr>`;
    } else {
      const e = getExt(r.name);
      const url = baseUrl + encodeURIComponent(r.path).replace(/%2F/g, '/');
      const modDate = r.modified ? new Date(r.modified).toLocaleDateString('es', {year:'numeric',month:'short',day:'numeric'}) : '—';
      const previewable = ['txt','log','bat','sh','cfg','ini','xml','md','jpg','jpeg','png','webp','gif'].includes(e);
      html += `<tr>
        <td>
          <div class="fname">${fileIcon(iconClass(e))}<a href="${esc(url)}" target="_blank" title="${esc(r.path)}">${esc(r.name)}</a></div>
          ${isSearch ? '<div class="search-result-path">' + esc(r.path) + '</div>' : ''}
        </td>
        <td class="fsize col-size">${formatBytes(r.size)}</td>
        <td class="col-type"><span class="ftype">${esc(r.type || e || '—')}</span></td>
        <td class="col-cat">${esc(r.device || '—')}</td>
        <td class="col-mod">${esc(modDate)}</td>
        <td>
          <div class="actions-cell">
            ${previewable ? '<button class="btn btn-sm btn-ghost preview-btn" data-url="'+esc(url)+'" data-name="'+esc(r.name)+'" data-ext="'+esc(e)+'" data-tippy-content="Preview">'+eyeSvg+'</button>' : ''}
            <a class="btn btn-sm btn-ghost" href="${esc(url)}" download="${esc(r.name)}" data-tippy-content="Download">${dlSvg}</a>
            <button class="btn btn-sm btn-ghost link-btn" data-link="${esc(url)}" data-tippy-content="Copy link">${linkSvg}</button>
          </div>
        </td>
      </tr>`;
    }
  });

  tbody.innerHTML = html;

  // Bind events
  tbody.querySelectorAll('button[data-nav]').forEach(b => {
    b.addEventListener('click', () => callbacks.onNav(b.dataset.nav));
  });
  tbody.querySelectorAll('.zip-dir').forEach(b => {
    b.addEventListener('click', () => callbacks.onZipDir(b.dataset.path));
  });
  tbody.querySelectorAll('.link-btn').forEach(b => {
    b.addEventListener('click', () => callbacks.onCopyLink(b.dataset.link));
  });
  tbody.querySelectorAll('.preview-btn').forEach(b => {
    b.addEventListener('click', () => callbacks.onPreview(b.dataset.url, b.dataset.name, b.dataset.ext));
  });
}

/**
 * Render the info panel
 */
export function renderInfoPanel(files, curPath) {
  const grid = document.getElementById('infoGrid');
  const panel = document.getElementById('infoPanel');
  if (!grid || !panel) return;

  const stats = dirStats(files, curPath);
  const { dirs, files: direct } = getEntries(files, curPath);
  const prefix = curPath ? curPath + '/' : '';
  const types = {};
  files.forEach(f => {
    if (f.path.startsWith(prefix)) { types[f.type] = (types[f.type]||0)+1; }
  });

  let html = `
    <div class="info-item"><div class="label">Total files</div><div class="value">${stats.count}</div></div>
    <div class="info-item"><div class="label">Total size</div><div class="value">${formatBytes(stats.size)}</div></div>
    <div class="info-item"><div class="label">Subdirectories</div><div class="value">${dirs.length}</div></div>
    <div class="info-item"><div class="label">Direct files</div><div class="value">${direct.length}</div></div>
  `;
  Object.keys(types).sort().forEach(t => {
    html += `<div class="info-item"><div class="label">${t}s</div><div class="value">${types[t]}</div></div>`;
  });
  grid.innerHTML = html;
  panel.style.display = '';

  // Update header stats
  const sf = document.querySelector('#s-files span:last-child');
  const ss = document.querySelector('#s-size span:last-child');
  if (sf) sf.textContent = stats.count + ' files';
  if (ss) ss.textContent = formatBytes(stats.size);
}
