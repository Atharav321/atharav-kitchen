#!/usr/bin/env node
/**
 * Atharav Kitchen — cache-busting build script
 * ---------------------------------------------
 * Static site (no bundler) hosted on Cloudflare Pages, so cache-busting is done
 * by stamping every local <script src> / <link rel=stylesheet href> with a
 * "?v=<VERSION>" query string. Browsers + Cloudflare's edge cache treat that as
 * a new URL, so a deploy is guaranteed to bust old cached JS/CSS — without
 * needing a bundler or renaming files.
 *
 * USAGE (run from repo root before every deploy):
 *   node build/version-assets.js
 *
 * It reads/increments build/VERSION, then rewrites the *.html files in place.
 * Run it once right before you zip/upload to Cloudflare Pages (or wire it into
 * the CI build command once GitHub -> Cloudflare Pages CI is set up — see
 * docs/BRANCHING.md).
 */
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const VERSION_FILE = path.join(__dirname, 'VERSION');

function nextVersion() {
  let v = 1;
  if (fs.existsSync(VERSION_FILE)) {
    v = parseInt(fs.readFileSync(VERSION_FILE, 'utf8').trim(), 10) || 0;
    v += 1;
  }
  fs.writeFileSync(VERSION_FILE, String(v));
  return v;
}

const VERSION = nextVersion();
const HTML_FILES = fs.readdirSync(ROOT).filter((f) => f.endsWith('.html'));

// Matches local (non-http, non-already-versioned) .js / .css src|href attributes
const ASSET_RE = /(src|href)="((?:js|css)\/[^"?]+\.(?:js|css))(?:\?v=\d+)?"/g;

let filesTouched = 0;
for (const file of HTML_FILES) {
  const full = path.join(ROOT, file);
  const original = fs.readFileSync(full, 'utf8');
  const updated = original.replace(ASSET_RE, (_m, attr, url) => `${attr}="${url}?v=${VERSION}"`);
  if (updated !== original) {
    fs.writeFileSync(full, updated);
    filesTouched++;
  }
}

// Bump the service worker's cache name too, so it re-precaches on activate.
const swPath = path.join(ROOT, 'sw.js');
if (fs.existsSync(swPath)) {
  let sw = fs.readFileSync(swPath, 'utf8');
  sw = sw.replace(/(CACHE_NAME\s*=\s*'atharav-v)\d+(')/, `$1${VERSION}$2`);
  sw = sw.replace(/(STATIC_CACHE\s*=\s*'atharav-static-v)\d+(')/, `$1${VERSION}$2`);
  fs.writeFileSync(swPath, sw);
}

console.log(`✅ Stamped build v${VERSION} across ${filesTouched} HTML file(s) + sw.js`);
