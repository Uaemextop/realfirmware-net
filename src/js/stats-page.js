/**
 * stats-page.js — Entry point for the statistics dashboard page
 */
import 'normalize.css';
import 'notyf/notyf.min.css';
import 'animate.css';

import { renderCategoryChart, renderTypeChart, renderDeviceSizeChart, renderExtensionChart } from './charts.js';
import { initUI, formatBytes } from './ui.js';

async function initStats() {
  initUI();

  let data;
  try {
    const resp = await fetch('file-index.json');
    data = await resp.json();
  } catch (e) {
    document.getElementById('statsContent').innerHTML = '<p style="color:var(--text2);text-align:center;padding:40px">Failed to load data</p>';
    return;
  }

  const files = data.files;

  // Summary cards
  const totalSize = files.reduce((s, f) => s + f.size, 0);
  const devices = new Set(files.map(f => f.device).filter(Boolean));
  const isps = new Set(files.map(f => f.isp).filter(Boolean));
  const exts = new Set(files.map(f => f.ext).filter(Boolean));

  document.getElementById('statTotal').textContent = files.length;
  document.getElementById('statSize').textContent = formatBytes(totalSize);
  document.getElementById('statDevices').textContent = devices.size;
  document.getElementById('statIsps').textContent = isps.size;
  document.getElementById('statCategories').textContent = data.categories.length;
  document.getElementById('statExtensions').textContent = exts.size;

  // Render charts
  renderCategoryChart(document.getElementById('chartCategory'), files);
  renderTypeChart(document.getElementById('chartType'), files);
  renderDeviceSizeChart(document.getElementById('chartDevice'), files);
  renderExtensionChart(document.getElementById('chartExtension'), files);

  // Top files by size
  const topFiles = [...files].sort((a, b) => b.size - a.size).slice(0, 10);
  const tbody = document.getElementById('topFilesBody');
  tbody.innerHTML = topFiles.map((f, i) => `
    <tr>
      <td>${i + 1}</td>
      <td><a href="index.html#p=${encodeURIComponent(f.path.substring(0, f.path.lastIndexOf('/')))}">${f.name}</a></td>
      <td class="fsize">${formatBytes(f.size)}</td>
      <td>${f.device || '—'}</td>
      <td>${f.type || '—'}</td>
    </tr>
  `).join('');
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initStats);
} else {
  initStats();
}
