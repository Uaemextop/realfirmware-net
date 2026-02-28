/**
 * preview.js — File preview using highlight.js (text) + marked (markdown)
 */
import hljs from 'highlight.js/lib/core';
import xml from 'highlight.js/lib/languages/xml';
import bash from 'highlight.js/lib/languages/bash';
import ini from 'highlight.js/lib/languages/ini';
import plaintext from 'highlight.js/lib/languages/plaintext';
import json from 'highlight.js/lib/languages/json';
import python from 'highlight.js/lib/languages/python';
import sql from 'highlight.js/lib/languages/sql';
import { marked } from 'marked';
import { formatBytes } from './ui.js';

// Register languages
hljs.registerLanguage('xml', xml);
hljs.registerLanguage('bash', bash);
hljs.registerLanguage('ini', ini);
hljs.registerLanguage('plaintext', plaintext);
hljs.registerLanguage('json', json);
hljs.registerLanguage('python', python);
hljs.registerLanguage('sql', sql);

const TEXT_EXTS = ['txt', 'log', 'bat', 'sh', 'cfg', 'ini', 'xml', 'md', 'config', 'conf', 'csv', 'xsl', 'xsml', 'json', 'py', 'sql', 'html', 'css', 'js'];
const IMG_EXTS = ['jpg', 'jpeg', 'png', 'webp', 'gif', 'bmp', 'svg'];
const BINARY_EXTS = ['bin', 'exe', 'dll', 'so', 'dylib', 'app', 'elf', 'o', 'a', 'lib'];

/**
 * Check if a file is previewable
 */
export function isPreviewable(ext) {
  return TEXT_EXTS.includes(ext) || IMG_EXTS.includes(ext) || BINARY_EXTS.includes(ext);
}

/**
 * Check if file is binary/executable
 */
export function isBinary(ext) {
  return BINARY_EXTS.includes(ext);
}

/**
 * Check if file is an image
 */
export function isImage(ext) {
  return IMG_EXTS.includes(ext);
}

/**
 * Check if file is text
 */
export function isText(ext) {
  return TEXT_EXTS.includes(ext);
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

  if (BINARY_EXTS.includes(ext)) {
    return `<div style="text-align:center;padding:var(--space-xl);color:var(--text2)">
      <svg viewBox="0 0 24 24" width="64" height="64" style="fill:var(--text3);margin-bottom:var(--space-md)">
        <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8l-6-6z"/>
        <path d="M14 2v6h6"/>
      </svg>
      <p style="font-size:var(--font-md);margin-bottom:var(--space-sm);color:var(--text)">Binary/Executable File</p>
      <p style="font-size:var(--font-sm)">Preview not available for binary files</p>
    </div>`;
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
  const map = {
    xml: 'xml', xsl: 'xml', xsml: 'xml', html: 'xml',
    cfg: 'ini', ini: 'ini', config: 'ini', conf: 'ini',
    bat: 'bash', sh: 'bash',
    json: 'json',
    py: 'python',
    sql: 'sql',
    js: 'javascript',
    css: 'css'
  };
  return map[ext] || 'plaintext';
}

function escapeHtml(str) {
  return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

/**
 * Render metadata section
 */
function renderMetadata(fileData) {
  const { name, size, modified, type, device, hash, ext, url } = fileData;

  const modDate = modified ? new Date(modified).toLocaleString('es', {
    year: 'numeric', month: 'short', day: 'numeric',
    hour: '2-digit', minute: '2-digit'
  }) : 'Unknown';

  let fileTypeLabel = 'Unknown';
  if (isImage(ext)) fileTypeLabel = 'Image';
  else if (isBinary(ext)) fileTypeLabel = 'Binary/Executable';
  else if (isText(ext)) fileTypeLabel = 'Text';

  return `
    <div class="file-metadata">
      <h4 style="font-size:var(--font-sm);font-weight:var(--font-weight-semibold);color:var(--text2);margin-bottom:var(--space-sm);text-transform:uppercase;letter-spacing:0.5px;">File Metadata</h4>
      <div class="metadata-grid">
        <div class="metadata-item">
          <span class="metadata-label">File Name:</span>
          <span class="metadata-value">${escapeHtml(name)}</span>
        </div>
        <div class="metadata-item">
          <span class="metadata-label">File Size:</span>
          <span class="metadata-value">${formatBytes(size)}</span>
        </div>
        <div class="metadata-item">
          <span class="metadata-label">File Type:</span>
          <span class="metadata-value">${fileTypeLabel} ${type ? `(${escapeHtml(type)})` : ''}</span>
        </div>
        <div class="metadata-item">
          <span class="metadata-label">Extension:</span>
          <span class="metadata-value">.${ext || 'none'}</span>
        </div>
        ${device ? `<div class="metadata-item">
          <span class="metadata-label">Device:</span>
          <span class="metadata-value">${escapeHtml(device)}</span>
        </div>` : ''}
        <div class="metadata-item">
          <span class="metadata-label">Modified:</span>
          <span class="metadata-value">${modDate}</span>
        </div>
        ${hash ? `<div class="metadata-item metadata-item-full">
          <span class="metadata-label">SHA-256:</span>
          <span class="metadata-value" style="font-family:var(--font-mono);font-size:var(--font-xs);word-break:break-all;">${escapeHtml(hash)}</span>
        </div>` : ''}
      </div>
    </div>
  `;
}

/**
 * Render action buttons
 */
function renderActions(fileData, canCopyContent) {
  const { url, name } = fileData;

  return `
    <div class="file-actions">
      <button class="btn btn-primary" onclick="window.open('${escapeHtml(url)}', '_blank')">
        <svg viewBox="0 0 16 16"><path d="M7.47 10.78a.75.75 0 001.06 0l3.75-3.75a.75.75 0 00-1.06-1.06L8.75 8.44V1.75a.75.75 0 00-1.5 0v6.69L4.78 5.97a.75.75 0 00-1.06 1.06l3.75 3.75zM3.75 13a.75.75 0 000 1.5h8.5a.75.75 0 000-1.5h-8.5z"/></svg>
        Download File
      </button>
      <button class="btn btn-accent" id="copyLinkBtn" data-url="${escapeHtml(url)}">
        <svg viewBox="0 0 16 16"><path d="M7.775 3.275a.75.75 0 001.06 1.06l1.25-1.25a2 2 0 112.83 2.83l-2.5 2.5a2 2 0 01-2.83 0 .75.75 0 00-1.06 1.06 3.5 3.5 0 004.95 0l2.5-2.5a3.5 3.5 0 00-4.95-4.95l-1.25 1.25zm-.025 5.475a.75.75 0 00-1.06 0l-1.25 1.25a2 2 0 11-2.83-2.83l2.5-2.5a2 2 0 012.83 0 .75.75 0 001.06-1.06 3.5 3.5 0 00-4.95 0l-2.5 2.5a3.5 3.5 0 004.95 4.95l1.25-1.25a.75.75 0 000-1.06z"/></svg>
        Copy Direct Link
      </button>
      ${canCopyContent ? `<button class="btn" id="copyContentBtn">
        <svg viewBox="0 0 16 16"><path d="M0 6.75C0 5.784.784 5 1.75 5h1.5a.75.75 0 010 1.5h-1.5a.25.25 0 00-.25.25v7.5c0 .138.112.25.25.25h7.5a.25.25 0 00.25-.25v-1.5a.75.75 0 011.5 0v1.5A1.75 1.75 0 019.25 16h-7.5A1.75 1.75 0 010 14.25v-7.5z"/><path d="M5 1.75C5 .784 5.784 0 6.75 0h7.5C15.216 0 16 .784 16 1.75v7.5A1.75 1.75 0 0114.25 11h-7.5A1.75 1.75 0 015 9.25v-7.5zm1.75-.25a.25.25 0 00-.25.25v7.5c0 .138.112.25.25.25h7.5a.25.25 0 00.25-.25v-7.5a.25.25 0 00-.25-.25h-7.5z"/></svg>
        Copy Content
      </button>` : ''}
    </div>
  `;
}

/**
 * Fetch and preview a file in the modal
 */
export async function showPreview(url, fileName, ext, modal, fileData) {
  const overlay = modal.closest('.modal-overlay');
  const title = modal.querySelector('.modal-header h3');
  const body = modal.querySelector('.modal-body');

  title.textContent = fileName;
  overlay.classList.add('show');

  // Store file content for copy functionality
  let fileContent = null;

  const canCopyContent = isText(ext);

  // Show loading state
  body.innerHTML = '<div style="text-align:center;padding:var(--space-xl)"><div class="spinner"></div><p style="margin-top:var(--space-md);color:var(--text2)">Loading preview...</p></div>';

  try {
    // For images, just show the image directly
    if (isImage(ext)) {
      const previewHtml = renderPreview(url, ext);
      const metadataHtml = renderMetadata({ ...fileData, name: fileName, ext, url });
      const actionsHtml = renderActions({ url, name: fileName }, false);

      body.innerHTML = `
        <div class="preview-content">${previewHtml}</div>
        ${metadataHtml}
        ${actionsHtml}
      `;
      bindActionButtons(body, url, null);
      return;
    }

    // For binary files, show metadata only
    if (isBinary(ext)) {
      const previewHtml = renderPreview('', ext);
      const metadataHtml = renderMetadata({ ...fileData, name: fileName, ext, url });
      const actionsHtml = renderActions({ url, name: fileName }, false);

      body.innerHTML = `
        <div class="preview-content">${previewHtml}</div>
        ${metadataHtml}
        ${actionsHtml}
      `;
      bindActionButtons(body, url, null);
      return;
    }

    // For text files, fetch and display content
    if (isText(ext)) {
      const resp = await fetch(url);
      if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
      const text = await resp.text();
      fileContent = text;

      const previewHtml = renderPreview(text, ext);
      const metadataHtml = renderMetadata({ ...fileData, name: fileName, ext, url });
      const actionsHtml = renderActions({ url, name: fileName }, canCopyContent);

      body.innerHTML = `
        <div class="preview-content">${previewHtml}</div>
        ${metadataHtml}
        ${actionsHtml}
      `;

      bindActionButtons(body, url, fileContent);
      return;
    }

    // For unknown/other file types, show metadata and download option
    const previewHtml = `<div style="text-align:center;padding:var(--space-xl);color:var(--text2)">
      <svg viewBox="0 0 24 24" width="64" height="64" style="fill:var(--text3);margin-bottom:var(--space-md)">
        <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8l-6-6z"/>
        <path d="M14 2v6h6"/>
      </svg>
      <p style="font-size:var(--font-md);margin-bottom:var(--space-sm);color:var(--text)">File Preview Not Available</p>
      <p style="font-size:var(--font-sm)">Use the download button below to access this file</p>
    </div>`;
    const metadataHtml = renderMetadata({ ...fileData, name: fileName, ext, url });
    const actionsHtml = renderActions({ url, name: fileName }, false);

    body.innerHTML = `
      <div class="preview-content">${previewHtml}</div>
      ${metadataHtml}
      ${actionsHtml}
    `;
    bindActionButtons(body, url, null);
  } catch (e) {
    body.innerHTML = `
      <div style="text-align:center;padding:var(--space-xl)">
        <p style="color:var(--danger);margin-bottom:var(--space-sm)">Failed to load preview</p>
        <p style="font-size:var(--font-sm);color:var(--text2)">${escapeHtml(e.message)}</p>
      </div>
    `;
  }
}

/**
 * Bind action button events
 */
function bindActionButtons(container, url, fileContent) {
  // Import copyToClipboard and notifySuccess dynamically to avoid circular dependency
  const copyLinkBtn = container.querySelector('#copyLinkBtn');
  if (copyLinkBtn) {
    copyLinkBtn.addEventListener('click', async () => {
      try {
        await navigator.clipboard.writeText(url);
        // Notify success
        if (window.notifySuccess) window.notifySuccess('Direct link copied to clipboard!');
      } catch (e) {
        if (window.notifyError) window.notifyError('Failed to copy link');
      }
    });
  }

  const copyContentBtn = container.querySelector('#copyContentBtn');
  if (copyContentBtn && fileContent) {
    copyContentBtn.addEventListener('click', async () => {
      try {
        await navigator.clipboard.writeText(fileContent);
        if (window.notifySuccess) window.notifySuccess('File content copied to clipboard!');
      } catch (e) {
        if (window.notifyError) window.notifyError('Failed to copy content');
      }
    });
  }
}
