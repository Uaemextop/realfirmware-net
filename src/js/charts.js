/**
 * charts.js — Chart.js visualizations for the stats dashboard
 */
import Chart from 'chart.js/auto';

const COLORS = [
  '#58a6ff', '#3fb950', '#f0883e', '#bc8cff',
  '#f85149', '#d29922', '#79c0ff', '#56d364',
  '#ffa657', '#d2a8ff', '#ff7b72', '#e3b341'
];

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
          labels: { color: '#8b949e', padding: 12, usePointStyle: true, pointStyleWidth: 10, font: { size: 12 } }
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
        x: { grid: { color: '#30363d' }, ticks: { color: '#8b949e' } },
        y: { grid: { display: false }, ticks: { color: '#8b949e', font: { size: 12 } } }
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

  return new Chart(canvas, {
    type: 'bar',
    data: {
      labels,
      datasets: [{
        label: 'Size (MB)',
        data,
        backgroundColor: '#58a6ff',
        borderRadius: 6,
        borderSkipped: false
      }]
    },
    options: {
      responsive: true,
      scales: {
        x: { grid: { display: false }, ticks: { color: '#8b949e', maxRotation: 45, font: { size: 11 } } },
        y: { grid: { color: '#30363d' }, ticks: { color: '#8b949e' } }
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
          labels: { color: '#8b949e', padding: 10, usePointStyle: true, font: { size: 11 } }
        }
      }
    }
  });
}
