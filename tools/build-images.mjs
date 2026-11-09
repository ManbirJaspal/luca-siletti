// Builds img/NN-{900,1200,2000}.webp from the originals on Luca's Wix site, then
// switches index.html from remote (Wix CDN) to local image mode.
import sharp from 'sharp';
import { mkdir, readFile, writeFile, stat } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const INDEX = join(ROOT, 'index.html');
const IMG = join(ROOT, 'img');
const SIZES = [900, 1200, 2000];
const MASTER_W = 2400;
const pad = n => String(n).padStart(2, '0');
const sleep = ms => new Promise(r => setTimeout(r, ms));

const html = await readFile(INDEX, 'utf8');
const photos = [...html.matchAll(/n:\s*(\d+),\s*id:'([0-9a-f]{32})'/g)].map(m => ({ n: Number(m[1]), id: m[2] }));
if (photos.length !== 27) throw new Error(`expected 27 photos in index.html, found ${photos.length}`);
await mkdir(IMG, { recursive: true });

async function exists(p) { try { const s = await stat(p); return s.size > 1024; } catch { return false; } }

async function download(id) {
  const url = `https://static.wixstatic.com/media/244304_${id}~mv2.jpg/v1/fit/w_${MASTER_W},h_${MASTER_W},q_90/master.jpg`;
  for (let attempt = 1; attempt <= 4; attempt++) {
    try {
      const res = await fetch(url, { headers: { 'user-agent': 'luca-siletti-site-build' } });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const buf = Buffer.from(await res.arrayBuffer());
      if (buf.length < 10_000) throw new Error(`too small (${buf.length} bytes)`);
      return buf;
    } catch (e) {
      if (attempt === 4) throw new Error(`${url}: ${e.message}`);
      await sleep(1500 * attempt);
    }
  }
}

let made = 0, kept = 0;
for (const p of photos) {
  const missing = [];
  for (const w of SIZES) if (!(await exists(join(IMG, `${pad(p.n)}-${w}.webp`)))) missing.push(w);
  if (!missing.length) { kept += SIZES.length; continue; }
  const master = await download(p.id);
  for (const w of missing) {
    const out = join(IMG, `${pad(p.n)}-${w}.webp`);
    await sharp(master).rotate().resize(w, w, { fit: 'inside', withoutEnlargement: true }).webp({ quality: 82 }).toFile(out);
    made++;
  }
  console.log(`photo ${pad(p.n)}: built ${missing.join('/')}`);
}
console.log(`built ${made} files, kept ${kept}`);

// Verify every file decodes before switching the site to local mode.
let ok = true;
for (const p of photos) for (const w of SIZES) {
  const f = join(IMG, `${pad(p.n)}-${w}.webp`);
  try {
    const meta = await sharp(f).metadata();
    if (meta.format !== 'webp' || !meta.width) throw new Error('bad metadata');
    const sha = createHash('sha256').update(await readFile(f)).digest('hex');
    console.log(`${pad(p.n)}-${w}.webp ${meta.width}x${meta.height} ${sha}`);
  } catch (e) { ok = false; console.error(`BAD ${f}: ${e.message}`); }
}
if (!ok) { console.error('some files are bad; leaving index.html in remote mode'); process.exit(1); }

const REMOTE = "const IMG_MODE = 'remote';";
const LOCAL = "const IMG_MODE = 'local';";
if (html.includes(REMOTE)) {
  await writeFile(INDEX, html.replace(REMOTE, LOCAL));
  console.log('index.html switched to local image mode');
} else if (html.includes(LOCAL)) {
  console.log('index.html already in local image mode');
} else {
  throw new Error('IMG_MODE line not found in index.html');
}
