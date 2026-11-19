// Copies the deployable files into dist/ (used by the GitHub Pages workflow).
// The app has no build step — this just keeps tests/docs/scripts out of the published site.
import { cp, mkdir, rm } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { join } from 'node:path';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const OUT = join(ROOT, 'dist');
const FILES = ['index.html', 'manifest.webmanifest', 'src', 'assets'];

await rm(OUT, { recursive: true, force: true });
await mkdir(OUT, { recursive: true });
for (const f of FILES) await cp(join(ROOT, f), join(OUT, f), { recursive: true });
console.log(`Built static site → ${OUT}`);
