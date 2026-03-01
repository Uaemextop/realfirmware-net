/**
 * filters.js — Filter management for the file explorer
 */

const FILTER_IDS = ['fCat', 'fDev', 'fIsp', 'fType'];

let storedAliases = {};

/**
 * Populate filter dropdowns from index metadata
 */
export function populateFilters(data) {
  addOptions('#fCat', data.types || []);
  // Include device aliases in dropdown
  const devices = [...(data.devices || [])];
  storedAliases = data.deviceAliases || {};
  if (storedAliases) {
    for (const alias of Object.keys(storedAliases)) {
      if (!devices.includes(alias)) devices.push(alias);
    }
    devices.sort();
  }
  addOptions('#fDev', devices);
  addOptions('#fIsp', data.isps || []);
  addOptions('#fType', (data.extensions || []).map(e => '.' + e));
}

function addOptions(selector, items) {
  const el = document.querySelector(selector);
  if (!el) return;
  const cur = el.value;
  while (el.options.length > 1) el.remove(1);
  items.forEach(v => {
    const o = document.createElement('option');
    o.value = v;
    o.textContent = v;
    el.appendChild(o);
  });
  el.value = cur || '';
}

/**
 * Apply active filters to file list
 */
export function applyFilters(files) {
  const cat = val('#fCat');
  const dev = val('#fDev');
  const isp = val('#fIsp');
  const ext = val('#fType');

  let result = files;
  if (cat) result = result.filter(f => f.type === cat);
  if (dev) result = result.filter(f => f.device === dev);
  if (isp) result = result.filter(f => f.isp === isp);
  if (ext) result = result.filter(f => '.' + f.ext === ext);
  return result;
}

/**
 * Render active filter tags
 */
export function renderFilterTags(container, onChange) {
  const labels = { fCat: 'Type', fDev: 'Device', fIsp: 'ISP', fType: 'Extension' };
  let html = '';
  FILTER_IDS.forEach(id => {
    const v = val('#' + id);
    if (v) {
      html += `<span class="filter-tag">${labels[id]}: ${v}<button data-filter="${id}" title="Remove">×</button></span>`;
    }
  });
  container.innerHTML = html;
  container.querySelectorAll('button').forEach(b => {
    b.addEventListener('click', () => {
      document.querySelector('#' + b.dataset.filter).value = '';
      onChange();
    });
  });
}

/**
 * Check if any filter is active
 */
export function hasActiveFilters() {
  return FILTER_IDS.some(id => val('#' + id));
}

/**
 * Clear all filters
 */
export function clearAllFilters() {
  FILTER_IDS.forEach(id => {
    const el = document.querySelector('#' + id);
    if (el) el.value = '';
  });
}

/**
 * Get/set filter values for URL state
 */
export function getFilterState() {
  const state = {};
  FILTER_IDS.forEach(id => {
    const v = val('#' + id);
    if (v) state[id] = v;
  });
  return state;
}

export function setFilterState(state) {
  FILTER_IDS.forEach(id => {
    const el = document.querySelector('#' + id);
    if (el) el.value = state[id] || '';
  });
}

function val(sel) {
  const el = document.querySelector(sel);
  return el ? el.value : '';
}
