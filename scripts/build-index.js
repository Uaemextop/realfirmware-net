#!/usr/bin/env node
/**
 * Build script: scans firmware-extracted/ and generates file-index.json
 * with enriched metadata (category, device, ISP, extension, type label).
 */
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const BASE = path.join(__dirname, '..', 'firmware-extracted');
const OUT = path.join(__dirname, '..', 'file-index.json');

const TYPE_MAP = {
  bin: 'Firmware', img: 'Firmware',
  txt: 'Document', docx: 'Document', log: 'Document',
  bat: 'Script', sh: 'Script', exe: 'Executable',
  xml: 'Config', cfg: 'Config', ini: 'Config',
  jpg: 'Image', jpeg: 'Image', png: 'Image', webp: 'Image', gif: 'Image',
  mp4: 'Video', zip: 'Archive'
};

function getTypeLabel(ext) {
  return TYPE_MAP[ext] || 'File';
}

function walkDir(dir) {
  const results = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      results.push(...walkDir(full));
    } else {
      results.push(full);
    }
  }
  return results;
}

const files = walkDir(BASE);
const index = files.map(fp => {
  const rel = path.relative(path.join(__dirname, '..'), fp);
  const st = fs.statSync(fp);
  const parts = path.relative(BASE, fp).split(path.sep);
  // Structure: category/device/isp/filename  (files at root have parts.length=1)
  const category = parts.length > 1 ? parts[0] : '';
  const device = parts.length > 2 ? parts[1] : '';
  const isp = parts.length > 3 ? parts[2] : '';
  const fileName = parts[parts.length - 1];
  const ext = path.extname(fileName).replace('.', '').toLowerCase();

  return {
    path: rel.replace(/\\/g, '/'),
    name: fileName,
    size: st.st_size !== undefined ? st.st_size : st.size,
    modified: st.mtime.toISOString(),
    category,
    device,
    isp,
    ext,
    type: getTypeLabel(ext)
  };
}).sort((a, b) => a.path.localeCompare(b.path));

// Also build aggregated metadata
const categories = [...new Set(index.map(f => f.category))].filter(Boolean).sort();
const devices = [...new Set(index.map(f => f.device))].filter(Boolean).sort();
const isps = [...new Set(index.map(f => f.isp))].filter(Boolean).sort();
const types = [...new Set(index.map(f => f.type))].sort();
const totalSize = index.reduce((s, f) => s + f.size, 0);

const output = {
  generated: new Date().toISOString(),
  totalFiles: index.length,
  totalSize,
  categories,
  devices,
  isps,
  types,
  files: index
};

fs.writeFileSync(OUT, JSON.stringify(output, null, 2));
console.log(`Generated ${OUT} — ${index.length} files, ${(totalSize / 1024 / 1024).toFixed(1)} MB total`);
