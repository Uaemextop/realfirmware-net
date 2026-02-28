/**
 * search.js — Dual search engine using Fuse.js (fuzzy) + Lunr (full-text index)
 */
import Fuse from 'fuse.js';
import lunr from 'lunr';

let fuseInstance = null;
let lunrIndex = null;
let fileMap = {};

/**
 * Initialize both search engines with file data
 */
export function initSearch(files) {
  fileMap = {};
  files.forEach((f, i) => {
    f._id = String(i);
    fileMap[f._id] = f;
  });

  // Fuse.js — fuzzy matching
  fuseInstance = new Fuse(files, {
    keys: [
      { name: 'name', weight: 3 },
      { name: 'path', weight: 1 },
      { name: 'device', weight: 2 },
      { name: 'isp', weight: 2 },
      { name: 'category', weight: 1 },
      { name: 'type', weight: 1 }
    ],
    threshold: 0.35,
    ignoreLocation: true,
    includeScore: true,
    includeMatches: true
  });

  // Lunr — full-text index
  lunrIndex = lunr(function () {
    this.ref('_id');
    this.field('name', { boost: 10 });
    this.field('device', { boost: 5 });
    this.field('isp', { boost: 3 });
    this.field('category');
    this.field('type');
    this.field('ext');

    files.forEach(f => {
      this.add({
        _id: f._id,
        name: f.name,
        device: f.device || '',
        isp: f.isp || '',
        category: f.category || '',
        type: f.type || '',
        ext: f.ext || ''
      });
    });
  });
}

/**
 * Search files — combines Fuse.js fuzzy + Lunr full-text results
 * @param {string} query
 * @param {number} limit
 * @returns {Array} matched file objects
 */
export function searchFiles(query, limit = 100) {
  if (!query || !fuseInstance) return [];

  // Fuse results
  const fuseResults = fuseInstance.search(query, { limit });
  const fuseIds = new Set(fuseResults.map(r => r.item._id));
  const results = fuseResults.map(r => r.item);

  // Lunr results (add any that Fuse missed)
  try {
    const lunrResults = lunrIndex.search(query + '*'); // wildcard suffix
    lunrResults.forEach(r => {
      if (!fuseIds.has(r.ref) && results.length < limit) {
        const file = fileMap[r.ref];
        if (file) results.push(file);
      }
    });
  } catch (e) {
    // Lunr can throw on some query syntax; fall back to fuse only
  }

  return results;
}
