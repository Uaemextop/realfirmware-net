/**
 * ui.js — UI helpers: tooltips (tippy.js), notifications (notyf), theme toggle
 */
import tippy from 'tippy.js';
import { Notyf } from 'notyf';

let notyf = null;

/**
 * Initialize UI components
 */
export function initUI() {
  // Initialize notification system
  notyf = new Notyf({
    duration: 2500,
    position: { x: 'right', y: 'bottom' },
    types: [
      { type: 'success', background: '#238636', icon: false },
      { type: 'error', background: '#f85149', icon: false },
      { type: 'info', background: '#58a6ff', icon: false }
    ]
  });

  // Initialize theme
  const saved = localStorage.getItem('theme');
  if (saved) document.documentElement.setAttribute('data-theme', saved);

  // Setup theme toggle
  const btn = document.getElementById('themeToggle');
  if (btn) {
    btn.addEventListener('click', toggleTheme);
    updateThemeIcon(btn);
  }

  // Setup mobile menu toggle
  const menuBtn = document.getElementById('mobileMenuBtn');
  const navLinks = document.getElementById('navLinks');
  if (menuBtn && navLinks) {
    menuBtn.addEventListener('click', () => navLinks.classList.toggle('show'));
    document.addEventListener('click', e => {
      if (!menuBtn.contains(e.target) && !navLinks.contains(e.target)) {
        navLinks.classList.remove('show');
      }
    });
  }
}

/**
 * Show a success notification
 */
export function notifySuccess(msg) {
  if (notyf) notyf.success(msg);
}

/**
 * Show an error notification
 */
export function notifyError(msg) {
  if (notyf) notyf.error(msg);
}

/**
 * Apply tippy tooltips to elements with [data-tippy-content]
 */
export function applyTooltips(container) {
  const targets = (container || document).querySelectorAll('[data-tippy-content]');
  if (targets.length) {
    tippy(targets, {
      theme: 'custom',
      animation: 'shift-away',
      duration: [150, 100]
    });
  }
}

/**
 * Copy text to clipboard with notification
 */
export function copyToClipboard(text) {
  navigator.clipboard.writeText(text).then(
    () => notifySuccess('Link copied to clipboard!'),
    () => notifyError('Failed to copy link')
  );
}

/**
 * Toggle dark/light theme
 */
function toggleTheme() {
  const current = document.documentElement.getAttribute('data-theme') || 'dark';
  const next = current === 'light' ? 'dark' : 'light';
  document.documentElement.setAttribute('data-theme', next);
  localStorage.setItem('theme', next);
  const btn = document.getElementById('themeToggle');
  if (btn) updateThemeIcon(btn);
}

function updateThemeIcon(btn) {
  const isDark = document.documentElement.getAttribute('data-theme') !== 'light';
  btn.innerHTML = isDark
    ? '<svg viewBox="0 0 16 16" width="18" height="18"><path fill="currentColor" d="M8 12a4 4 0 100-8 4 4 0 000 8zm0 1.5a5.5 5.5 0 110-11 5.5 5.5 0 010 11zM8 0a.75.75 0 01.75.75v1.5a.75.75 0 01-1.5 0V.75A.75.75 0 018 0zm0 13a.75.75 0 01.75.75v1.5a.75.75 0 01-1.5 0v-1.5A.75.75 0 018 13zM2.343 2.343a.75.75 0 011.061 0l1.06 1.06a.75.75 0 01-1.06 1.061l-1.06-1.06a.75.75 0 010-1.06zm9.193 9.193a.75.75 0 011.06 0l1.061 1.06a.75.75 0 11-1.06 1.061l-1.061-1.06a.75.75 0 010-1.061zM0 8a.75.75 0 01.75-.75h1.5a.75.75 0 010 1.5H.75A.75.75 0 010 8zm13 0a.75.75 0 01.75-.75h1.5a.75.75 0 010 1.5h-1.5A.75.75 0 0113 8zM2.343 13.657a.75.75 0 010-1.06l1.06-1.061a.75.75 0 111.061 1.06l-1.06 1.061a.75.75 0 01-1.061 0zm9.193-9.193a.75.75 0 010-1.06l1.061-1.061a.75.75 0 111.06 1.06l-1.06 1.06a.75.75 0 01-1.06.001z"/></svg>'
    : '<svg viewBox="0 0 16 16" width="18" height="18"><path fill="currentColor" d="M9.598 1.591a.75.75 0 01.785-.175 7 7 0 11-8.967 8.967.75.75 0 01.961-.96 5.5 5.5 0 007.046-7.046.75.75 0 01.175-.786z"/></svg>';
}

/**
 * Format bytes to human readable
 */
export function formatBytes(bytes) {
  if (!bytes) return '0 B';
  const k = 1024;
  const units = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + units[i];
}
