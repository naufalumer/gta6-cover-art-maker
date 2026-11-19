// Vice Cover Studio — entrypoint for the gta6-cover-art-01 bounty.
// This Node 22 program (standard library only) hands the app in: it copies
// the static app/ folder and the screenshots/ folder beside this file into
// the output directory and writes dossier.json there, using the vendored
// make.fun library. The app itself is plain static files — index.html plus
// ES modules, no build step, no network — that turn photos and a caption
// into a multi-panel GTA-style poster cover and export it as a PNG.
// The dossier is the summary the judge reads, so the program must write
// exactly the bytes buildDossier produces from the copied files.
//
// Local run: mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts
// (Outside the grader, MAKEFUN_OUTPUT_DIR stands in for /output.)
import { cpSync, existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildDossier } from './vendor/makefun-app.ts';

const repoRoot = fileURLToPath(new URL('.', import.meta.url));
const destDir = process.env.MAKEFUN_OUTPUT_DIR ?? '/output';

mkdirSync(destDir, { recursive: true });
cpSync(join(repoRoot, 'app'), join(destDir, 'app'), { recursive: true });
mkdirSync(join(destDir, 'screenshots'), { recursive: true });
if (existsSync(join(repoRoot, 'screenshots'))) {
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
