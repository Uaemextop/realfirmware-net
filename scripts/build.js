#!/usr/bin/env node
/**
 * build.js — Build pipeline using esbuild
 * Bundles JS modules + CSS into assets/ for browser consumption
 */
const esbuild = require('esbuild');
const path = require('path');
const fs = require('fs');

const OUTDIR = path.join(__dirname, '..', 'assets');

async function build() {
  // Ensure output dirs exist
  fs.mkdirSync(path.join(OUTDIR, 'js'), { recursive: true });
  fs.mkdirSync(path.join(OUTDIR, 'css'), { recursive: true });

  // Bundle main app JS + CSS
  await esbuild.build({
    entryPoints: [path.join(__dirname, '..', 'src', 'js', 'main.js')],
    bundle: true,
    minify: true,
    sourcemap: true,
    format: 'iife',
    target: ['es2020'],
    outfile: path.join(OUTDIR, 'js', 'app.bundle.js'),
    loader: { '.css': 'css' },
    define: { 'process.env.NODE_ENV': '"production"' }
  });

  // Bundle stats page JS
  await esbuild.build({
    entryPoints: [path.join(__dirname, '..', 'src', 'js', 'stats-page.js')],
    bundle: true,
    minify: true,
    sourcemap: true,
    format: 'iife',
    target: ['es2020'],
    outfile: path.join(OUTDIR, 'js', 'stats.bundle.js'),
    loader: { '.css': 'css' },
    define: { 'process.env.NODE_ENV': '"production"' }
  });

  // Bundle custom CSS
  const cssFiles = [
    'variables.css',
    'layout.css',
    'components.css',
    'responsive.css',
    'animations.css'
  ].map(f => path.join(__dirname, '..', 'src', 'css', f));

  // Concatenate CSS and minify via esbuild
  const combined = cssFiles.map(f => fs.readFileSync(f, 'utf-8')).join('\n');
  const tmpCss = path.join(__dirname, '..', 'src', 'css', '_combined.css');
  fs.writeFileSync(tmpCss, combined);

  await esbuild.build({
    entryPoints: [tmpCss],
    bundle: true,
    minify: true,
    outfile: path.join(OUTDIR, 'css', 'app.css'),
    loader: { '.css': 'css' }
  });

  // Clean up temp file
  fs.unlinkSync(tmpCss);

  // Copy normalize.css for explicit link tag
  const normSrc = path.join(__dirname, '..', 'node_modules', 'normalize.css', 'normalize.css');
  if (fs.existsSync(normSrc)) {
    fs.copyFileSync(normSrc, path.join(OUTDIR, 'css', 'normalize.css'));
  }

  console.log('Build complete:');
  console.log('  assets/js/app.bundle.js');
  console.log('  assets/js/stats.bundle.js');
  console.log('  assets/css/app.css');
}

build().catch(e => { console.error(e); process.exit(1); });
