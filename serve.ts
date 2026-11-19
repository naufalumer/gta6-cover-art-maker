// Development server for the Vice Cover Studio app (Node 22, stdlib only).
// Serves the app/ folder over plain HTTP so the entry can be tried in a
// desktop browser with no build step: `node serve.ts` then open
// http://localhost:8080. It is a local convenience only — it answers only
// on loopback, sends the content types a static offline app needs, and
// refuses every path that would escape app/. It does nothing else.
import { createReadStream, statSync } from 'node:fs';
import { createServer } from 'node:http';
import { extname, join, normalize, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

// The folder served, resolved once at startup.
const appRoot = resolve(fileURLToPath(new URL('./app', import.meta.url)));

// Pick the port from --port, falling back to 8080 for anything missing or
// out of range.
const cliArgs = process.argv.slice(2);
const portFlag = cliArgs.indexOf('--port');
const wanted = portFlag === -1 ? 8080 : Number(cliArgs[portFlag + 1]);
const port = Number.isInteger(wanted) && wanted > 0 && wanted < 65536 ? wanted : 8080;

// Content types by file extension. Anything unlisted is served as bytes.
const CONTENT_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.txt': 'text/plain; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.webp': 'image/webp',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.otf': 'font/otf',
  '.ttf': 'font/ttf',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.wasm': 'application/wasm',
  '.bin': 'application/octet-stream',
  '.wav': 'audio/wav',
  '.mp3': 'audio/mpeg',
  '.ogg': 'audio/ogg',
};

function contentTypeFor(file) {
  return CONTENT_TYPES[extname(file).toLowerCase()] ?? 'application/octet-stream';
}

// Resolve a request path to a file inside appRoot, or null when the path
// would escape it. A trailing slash means the folder's index.html.
function fileInsideRoot(pathname) {
  const cleaned = pathname.endsWith('/') ? `${pathname}index.html` : pathname;
  const target = resolve(join(appRoot, normalize(cleaned)));
  if (target !== appRoot && !target.startsWith(appRoot + sep)) return null;
  return target;
}

createServer((req, res) => {
  let pathname;
  try {
    pathname = decodeURIComponent(new URL(req.url ?? '/', 'http://localhost').pathname);
  } catch {
    res.writeHead(400).end('bad request');
    return;
  }
  const file = fileInsideRoot(pathname);
  if (file === null) {
    res.writeHead(403).end('forbidden');
    return;
  }
  let size;
  try {
    const info = statSync(file);
    if (!info.isFile()) throw new Error('not a file');
    size = info.size;
  } catch {
    res.writeHead(404).end('not found');
    return;
  }
  res.writeHead(200, {
    'content-type': contentTypeFor(file),
    'content-length': size,
    'cache-control': 'no-store',
  });
  createReadStream(file).pipe(res);
}).listen(port, '127.0.0.1', () => {
  console.log(`app/ is on http://localhost:${port}`);
});
