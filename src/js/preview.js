/**
 * preview.js — File preview using highlight.js (text) + marked (markdown)
 */
import hljs from 'highlight.js/lib/core';
import xml from 'highlight.js/lib/languages/xml';
import bash from 'highlight.js/lib/languages/bash';
import ini from 'highlight.js/lib/languages/ini';
import plaintext from 'highlight.js/lib/languages/plaintext';
import { marked } from 'marked';

// Register languages
hljs.registerLanguage('xml', xml);
hljs.registerLanguage('bash', bash);
hljs.registerLanguage('ini', ini);
hljs.registerLanguage('plaintext', plaintext);

const TEXT_EXTS = ['txt', 'log', 'bat', 'sh', 'cfg', 'ini', 'xml', 'md'];
const IMG_EXTS = ['jpg', 'jpeg', 'png', 'webp', 'gif'];

/**
 * Check if a file is previewable
 */
export function isPreviewable(ext) {
  return TEXT_EXTS.includes(ext) || IMG_EXTS.includes(ext);
}

/**
 * Generate preview HTML for a file
 * @param {string} content - file content (text) or URL (image)
 * @param {string} ext - file extension
 * @returns {string} HTML
 */
export function renderPreview(content, ext) {
  if (IMG_EXTS.includes(ext)) {
    return `<img src="${content}" class="preview-img lazyload" alt="Preview">`;
  }

  if (ext === 'md') {
    const html = marked.parse(content, { breaks: true });
    return `<div class="markdown-body">${html}</div>`;
  }

  // Text/code files
  const lang = getLanguage(ext);
  let highlighted;
  try {
    highlighted = hljs.highlight(content.substring(0, 50000), { language: lang }).value;
  } catch {
    highlighted = escapeHtml(content.substring(0, 50000));
  }
  return `<pre><code class="hljs">${highlighted}</code></pre>`;
}

function getLanguage(ext) {
  const map = { xml: 'xml', cfg: 'ini', ini: 'ini', bat: 'bash', sh: 'bash' };
  return map[ext] || 'plaintext';
}

function escapeHtml(str) {
  return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

/**
 * Fetch and preview a file in the modal
 */
export async function showPreview(url, fileName, ext, modal) {
  const overlay = modal.closest('.modal-overlay');
  const title = modal.querySelector('.modal-header h3');
  const body = modal.querySelector('.modal-body');

  title.textContent = fileName;
  overlay.classList.add('show');

  if (IMG_EXTS.includes(ext)) {
    body.innerHTML = renderPreview(url, ext);
    return;
  }

  body.innerHTML = '<div style="text-align:center;padding:20px"><div class="spinner"></div></div>';

  try {
    const resp = await fetch(url);
    if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
    const text = await resp.text();
    body.innerHTML = renderPreview(text, ext);
  } catch (e) {
    body.innerHTML = `<p style="color:var(--red)">Failed to load preview</p>`;
  }
}
