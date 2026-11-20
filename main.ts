// Vice Cover Studio — the hand-in program for gta6-cover-art-01.
//
// Node 22, standard library only. It copies the static app/ folder and the
// screenshots/ folder next to this file into the output directory and writes
// dossier.json there with the vendored make.fun library. The app itself is
// plain static files — index.html plus ES modules, no build step, no
// network — turning photos and a caption into a multi-panel GTA-style poster
// cover, exported as a PNG. The dossier is the summary the judge reads, so
// this program must write exactly the bytes buildDossier produces from the
// copied files.
//
// Try it locally: mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts
// (Outside the grader, MAKEFUN_OUTPUT_DIR stands in for /output.)
import { cpSync, existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildDossier } from './vendor/makefun-app.ts';

// Where the repository sits, and where the hand-in goes: /output in the
// grader, or MAKEFUN_OUTPUT_DIR when run by hand.
const repoRoot = fileURLToPath(new URL('.', import.meta.url));
const destDir = process.env.MAKEFUN_OUTPUT_DIR ?? '/output';

mkdirSync(destDir, { recursive: true });
cpSync(join(repoRoot, 'app'), join(destDir, 'app'), { recursive: true });
if (existsSync(join(repoRoot, 'screenshots'))) {
  // Only create the output screenshots/ when the repository has one: an
  // empty directory would make buildDossier refuse the entry for holding
  // no image, and the refusal should name the missing source, not an
  // empty folder this program created.
  mkdirSync(join(destDir, 'screenshots'), { recursive: true });
  cpSync(join(repoRoot, 'screenshots'), join(destDir, 'screenshots'), { recursive: true });
}

// Dossier caps mirror the scorer's own limits (see the kit's reference/
// gate.json): the text budget shapes the dossier bytes, and the rest refuse
// an entry the scorer would refuse — at most 4 screenshots, each at most
// 256 KiB; app/ at most 993 files and 48 MiB in all; no app/ path longer
// than 1000 bytes. app/ shares /output's own 1000-entry cap with
// screenshots/ and dossier.json, so leave room.
writeFileSync(
  join(destDir, 'dossier.json'),
  buildDossier(destDir, {
    text_max_bytes: 163840,
    screenshots: { max: 4, max_bytes: 262144 },
    app_max_files: 993,
    app_max_bytes: 50331648,
    app_path_max_bytes: 1000,
  }),
);

// A short report so a local run shows what was handed in.
import { readdirSync, statSync } from 'node:fs';
function countFiles(dir) {
  let n = 0;
  for (const name of readdirSync(dir, { withFileTypes: true })) {
    const p = join(dir, name.name);
    n += name.isDirectory() ? countFiles(p) : 1;
  }
  return n;
}
const dossierBytes = statSync(join(destDir, 'dossier.json')).size;
console.log(
  `Vice Cover Studio handed in: ${countFiles(join(destDir, 'app'))} app files, ` +
  `${readdirSync(join(destDir, 'screenshots')).length} screenshots, ` +
  `dossier.json ${dossierBytes} bytes -> ${destDir}`,
);
