/**
 * charts.js — Chart.js visualizations for the stats dashboard
 */
import Chart from 'chart.js/auto';

const COLORS = [
  '#58a6ff', '#3fb950', '#f0883e', '#bc8cff',
  '#f85149', '#d29922', '#79c0ff', '#56d364',
  '#ffa657', '#d2a8ff', '#ff7b72', '#e3b341'
];

/** Read a CSS custom property from :root */
function cssVar(name) {
  return getComputedStyle(document.documentElement).getPropertyValue(name).trim();
}

/** Get theme-aware axis/grid colors */
function themeColors() {
  return {
    grid: cssVar('--border') || '#30363d',
    tick: cssVar('--text2') || '#8b949e'
  };
}

/**
 * Render category distribution doughnut chart
 */
export function renderCategoryChart(canvas, files) {
  const counts = {};
  files.forEach(f => {
    const cat = f.type || 'other';
    counts[cat] = (counts[cat] || 0) + 1;
  });
  const labels = Object.keys(counts).sort();
  const data = labels.map(l => counts[l]);
  const tc = themeColors();

  return new Chart(canvas, {
    type: 'doughnut',
    data: {
      labels,
      datasets: [{
        data,
        backgroundColor: COLORS.slice(0, labels.length),
        borderColor: 'transparent',
        borderWidth: 0
      }]
    },
    options: {
      responsive: true,
      plugins: {
        legend: {
          position: 'bottom',
          labels: { color: tc.tick, padding: 12, usePointStyle: true, pointStyleWidth: 10, font: { size: 12 } }
        }
      }
    }
  });
}

/**
 * Render file type distribution bar chart
 */
export function renderTypeChart(canvas, files) {
  const counts = {};
  files.forEach(f => {
    const t = f.type || 'Unknown';
    counts[t] = (counts[t] || 0) + 1;
  });
  const labels = Object.keys(counts).sort();
  const data = labels.map(l => counts[l]);
  const tc = themeColors();

  return new Chart(canvas, {
    type: 'bar',
    data: {
      labels,
      datasets: [{
        label: 'Files',
        data,
        backgroundColor: COLORS.slice(0, labels.length),
        borderRadius: 6,
        borderSkipped: false
      }]
    },
    options: {
      responsive: true,
      indexAxis: 'y',
      scales: {
        x: { grid: { color: tc.grid }, ticks: { color: tc.tick } },
        y: { grid: { display: false }, ticks: { color: tc.tick, font: { size: 12 } } }
      },
      plugins: {
        legend: { display: false }
      }
    }
  });
}

/**
 * Render size distribution by device bar chart
 */
export function renderDeviceSizeChart(canvas, files) {
  const sizes = {};
  files.forEach(f => {
    const d = f.device || 'Root';
    sizes[d] = (sizes[d] || 0) + f.size;
  });
  // Top 15 by size
  const sorted = Object.entries(sizes).sort((a, b) => b[1] - a[1]).slice(0, 15);
  const labels = sorted.map(e => e[0]);
  const data = sorted.map(e => +(e[1] / 1024 / 1024).toFixed(1));
  const tc = themeColors();
  const accentColor = cssVar('--accent') || '#58a6ff';

  return new Chart(canvas, {
    type: 'bar',
    data: {
      labels,
      datasets: [{
        label: 'Size (MB)',
        data,
        backgroundColor: accentColor,
        borderRadius: 6,
        borderSkipped: false
      }]
    },
    options: {
      responsive: true,
      scales: {
        x: { grid: { display: false }, ticks: { color: tc.tick, maxRotation: 45, font: { size: 11 } } },
        y: { grid: { color: tc.grid }, ticks: { color: tc.tick } }
      },
      plugins: {
        legend: { display: false }
      }
    }
  });
}

/**
 * Render file extension pie chart
 */
export function renderExtensionChart(canvas, files) {
  const counts = {};
  files.forEach(f => {
    const e = f.ext || 'none';
    counts[e] = (counts[e] || 0) + 1;
  });
  // Top 10
  const sorted = Object.entries(counts).sort((a, b) => b[1] - a[1]).slice(0, 10);
  const labels = sorted.map(e => '.' + e[0]);
  const data = sorted.map(e => e[1]);
  const tc = themeColors();

  return new Chart(canvas, {
    type: 'pie',
    data: {
      labels,
      datasets: [{
        data,
        backgroundColor: COLORS.slice(0, labels.length),
        borderColor: 'transparent'
      }]
    },
    options: {
      responsive: true,
      plugins: {
        legend: {
          position: 'bottom',
          labels: { color: tc.tick, padding: 10, usePointStyle: true, font: { size: 11 } }
        }
      }
    }
  });
}
