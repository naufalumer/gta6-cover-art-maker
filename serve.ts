// Development server for the Vice Cover Studio app (Node 22, stdlib only).
// It serves the app/ folder over plain HTTP so the entry can be tried in a
// desktop browser with no build step: `node serve.ts`, then open
// http://localhost:8080. A local convenience only — it answers on loopback
// alone, sends the content types a static offline app needs, and refuses
// every path that would escape app/. It does nothing else.
import { createReadStream, statSync } from 'node:fs';
import { createServer } from 'node:http';
import { extname, join, normalize, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

// The folder served, resolved once at startup.
const appRoot = resolve(fileURLToPath(new URL('./app', import.meta.url)));

// Which port to listen on: --port, or 8080 when it is missing or invalid.
function pickPort() {
  const args = process.argv.slice(2);
  const at = args.indexOf('--port');
  if (at === -1) return 8080;
  const n = Number(args[at + 1]);
  return Number.isInteger(n) && n > 0 && n < 65536 ? n : 8080;
}

// Content types by file extension. Anything unlisted is served as bytes.
const MIME_TYPES = {
  '.bin': 'application/octet-stream',
  '.css': 'text/css; charset=utf-8',
  '.gif': 'image/gif',
  '.html': 'text/html; charset=utf-8',
  '.ico': 'image/x-icon',
  '.jpeg': 'image/jpeg',
  '.jpg': 'image/jpeg',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.mp3': 'audio/mpeg',
  '.ogg': 'audio/ogg',
  '.otf': 'font/otf',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
  '.ttf': 'font/ttf',
  '.txt': 'text/plain; charset=utf-8',
  '.wasm': 'application/wasm',
  '.wav': 'audio/wav',
  '.webp': 'image/webp',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
};

function mimeFor(file) {
  return MIME_TYPES[extname(file).toLowerCase()] ?? 'application/octet-stream';
}

// Resolve a request path to a file inside appRoot, or null when the path
// would escape it. A trailing slash means the folder's index.html.
function resolveInside(pathname) {
  const cleaned = pathname.endsWith('/') ? `${pathname}index.html` : pathname;
  const target = resolve(join(appRoot, normalize(cleaned)));
  if (target !== appRoot && !target.startsWith(appRoot + sep)) return null;
  return target;
}

function refuse(res, code, text) {
  res.writeHead(code).end(text);
}

createServer((req, res) => {
  let pathname;
  try {
    pathname = decodeURIComponent(new URL(req.url ?? '/', 'http://localhost').pathname);
  } catch {
    refuse(res, 400, 'bad request');
    return;
  }
  const file = resolveInside(pathname);
  if (file === null) {
    refuse(res, 403, 'forbidden');
    return;
  }
  let size;
  try {
    const info = statSync(file);
    if (!info.isFile()) throw new Error('not a file');
    size = info.size;
  } catch {
    refuse(res, 404, 'not found');
    return;
  }
  res.writeHead(200, {
    'content-type': mimeFor(file),
    'content-length': size,
    'cache-control': 'no-store',
  });
  createReadStream(file).pipe(res);
}).listen(pickPort(), '127.0.0.1', () => {
  console.log(`app/ is on http://localhost:${pickPort()}`);
});
