/**
 * download.js — Zip download functionality using JSZip + FileSaver
 */
import JSZip from 'jszip';
import { saveAs } from 'file-saver';

/**
 * Download a directory as a .zip file with progress UI
 * @param {Array} files - files to download
 * @param {string} dirPath - directory path prefix
 * @param {Function} onProgress - callback(percent, message)
 * @param {Function} onDone - callback when finished
 */
export async function downloadDirAsZip(files, dirPath, onProgress, onDone) {
  const prefix = dirPath ? dirPath + '/' : '';
  const dirFiles = files.filter(f => f.path.startsWith(prefix));
  if (!dirFiles.length) {
    if (onDone) onDone();
    return;
  }

  const zip = new JSZip();
  const base = getBaseUrl();
  let done = 0;
  const total = dirFiles.length;
  const batchSize = 5;

  for (let i = 0; i < total; i += batchSize) {
    const batch = dirFiles.slice(i, i + batchSize);
    await Promise.all(batch.map(async f => {
      const rel = f.path.slice(prefix.length);
      try {
        const url = base + encodeURIComponent(f.path).replace(/%2F/g, '/');
        const resp = await fetch(url);
        if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
        zip.file(rel, await resp.blob());
      } catch (e) {
        console.warn('Skip:', f.path, e.message);
      }
      done++;
      const pct = Math.round((done / total) * 100);
      if (onProgress) onProgress(pct, `Downloading: ${rel} (${done}/${total})`);
    }));
  }

  if (onProgress) onProgress(100, 'Compressing…');

  const blob = await zip.generateAsync({ type: 'blob' }, meta => {
    if (onProgress) onProgress(meta.percent | 0, `Compressing: ${meta.percent.toFixed(0)}%`);
  });

  const name = dirPath ? dirPath.split('/').pop() : 'realfirmware';
  saveAs(blob, name + '.zip');

  if (onDone) onDone();
}

/**
 * Get the base URL for file downloads
 */
function getBaseUrl() {
  return location.origin + location.pathname.replace(/[^/]*$/, '');
}

/**
 * Generate a direct download URL for a file
 */
export function fileDownloadUrl(filePath) {
  return getBaseUrl() + encodeURIComponent(filePath).replace(/%2F/g, '/');
}

/**
 * Generate a shareable direct link to a file's location
 */
export function fileDirectLink(filePath) {
  const dir = filePath.substring(0, filePath.lastIndexOf('/'));
  const params = new URLSearchParams();
  params.set('p', dir);
  return location.origin + location.pathname + '#' + params.toString();
}

/**
 * Download selected files as a .zip archive
 * @param {Array} selectedFiles - array of file objects to download
 * @param {Function} onProgress - callback(percent, message)
 * @param {Function} onDone - callback when finished
 */
export async function downloadSelectedAsZip(selectedFiles, onProgress, onDone) {
  if (!selectedFiles.length) {
    if (onDone) onDone();
    return;
  }

  const zip = new JSZip();
  const base = getBaseUrl();
  let done = 0;
  const total = selectedFiles.length;
  const batchSize = 5;

  for (let i = 0; i < total; i += batchSize) {
    const batch = selectedFiles.slice(i, i + batchSize);
    await Promise.all(batch.map(async f => {
      try {
        const url = base + encodeURIComponent(f.path).replace(/%2F/g, '/');
        const resp = await fetch(url);
        if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
        zip.file(f.path, await resp.blob());
      } catch (e) {
        console.warn('Skip:', f.path, e.message);
      }
      done++;
      const pct = Math.round((done / total) * 100);
      if (onProgress) onProgress(pct, `Downloading: ${f.name} (${done}/${total})`);
    }));
  }

  if (onProgress) onProgress(100, 'Compressing…');

  const blob = await zip.generateAsync({ type: 'blob' }, meta => {
    if (onProgress) onProgress(meta.percent | 0, `Compressing: ${meta.percent.toFixed(0)}%`);
  });

  saveAs(blob, `selected-files-${Date.now()}.zip`);

  if (onDone) onDone();
}
