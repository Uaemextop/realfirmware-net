#!/usr/bin/env node
/**
 * build-index.js — Scans device directories and generates file-index.json
 * with enriched metadata: device, category, ISP, extension, type, SHA256 hash.
 */
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const BASE = path.join(__dirname, '..');
const OUT = path.join(__dirname, '..', 'file-index.json');
const EXCLUDE_DIRS = ['.git', '.github', 'assets', 'scripts', 'src', 'node_modules', 'dist', 'tools'];

// Device aliases: variant model names → compatible base device directory
const DEVICE_ALIASES = {
  'Huawei-HG8145V5-12': 'Huawei-HG8145V5'
};

const TYPE_MAP = {
  bin: 'Firmware', img: 'Firmware',
  txt: 'Document', docx: 'Document', log: 'Document',
  bat: 'Script', sh: 'Script', exe: 'Executable',
  xml: 'Config', cfg: 'Config', ini: 'Config',
  jpg: 'Image', jpeg: 'Image', png: 'Image', webp: 'Image', gif: 'Image',
  mp4: 'Video', zip: 'Archive'
};

// Known extensionless firmware/system files
const NAME_TYPE_MAP = {
  rootfs: 'Firmware',
  uimage: 'Firmware',
  fwu_ver: 'Config',
  hw_ver: 'Config'
};

function getTypeLabel(ext, name) {
  if (ext && TYPE_MAP[ext]) return TYPE_MAP[ext];
  const lower = (name || '').toLowerCase();
  if (NAME_TYPE_MAP[lower]) return NAME_TYPE_MAP[lower];
  return 'Other';
}

function sha256(filePath) {
  const data = fs.readFileSync(filePath);
  return crypto.createHash('sha256').update(data).digest('hex');
}

function walkDir(dir, isRoot = false) {
  const results = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    // Skip excluded directories at root level
    if (isRoot && entry.isDirectory() && EXCLUDE_DIRS.includes(entry.name)) {
      continue;
    }
    // Skip hidden files and specific files at root
    if (isRoot && (entry.name.startsWith('.') ||
        ['package.json', 'package-lock.json', 'README.md', 'file-index.json',
         'index.html', 'about.html', 'stats.html'].includes(entry.name))) {
      continue;
    }
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      results.push(...walkDir(full, false));
    } else {
      results.push(full);
    }
  }
  return results;
}

const files = walkDir(BASE, true);
const index = files.map(fp => {
  const rel = path.relative(path.join(__dirname, '..'), fp).replace(/\\/g, '/');
  const st = fs.statSync(fp);
  const parts = path.relative(BASE, fp).split(path.sep);
  // Structure: Device/ISP/filename (or root files like MANIFEST.txt)
  const fileName = parts[parts.length - 1];
  const device = parts.length >= 2 ? parts[0] : '';
  const isp = parts.length >= 3 ? parts[1] : '';
  const ext = path.extname(fileName).replace('.', '').toLowerCase();
  const size = st.size;
  const type = getTypeLabel(ext, fileName);

  return {
    path: rel,
    name: fileName,
    size,
    modified: st.mtime.toISOString(),
    device,
    isp,
    ext,
    type,
    sha256: sha256(fp)
  };
}).sort((a, b) => a.path.localeCompare(b.path));

// Aggregated metadata
const devices = [...new Set(index.map(f => f.device).filter(Boolean))].sort();
const isps = [...new Set(index.map(f => f.isp).filter(Boolean))].sort();
const types = [...new Set(index.map(f => f.type))].sort();
const extensions = [...new Set(index.map(f => f.ext).filter(Boolean))].sort();
const totalSize = index.reduce((s, f) => s + f.size, 0);

const output = {
  generated: new Date().toISOString(),
  totalFiles: index.length,
  totalSize,
  devices,
  isps,
  types,
  extensions,
  deviceAliases: DEVICE_ALIASES,
  files: index
};

fs.writeFileSync(OUT, JSON.stringify(output, null, 2));
console.log(`Generated ${OUT}`);
console.log(`  ${index.length} files, ${(totalSize / 1024 / 1024).toFixed(1)} MB`);
console.log(`  ${devices.length} devices, ${types.length} types, ${isps.length} ISPs`);
