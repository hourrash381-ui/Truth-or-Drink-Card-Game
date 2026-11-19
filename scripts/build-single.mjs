// Bundles the whole app into ONE self-contained HTML file (CSS + JS inlined).
// Use it to host the game somewhere that only accepts a single file, such as a
// Claude artifact, a gist preview or an email attachment.
//
//   npm run build:single                  → dist/truth-or-drink.html
//   node scripts/build-single.mjs out.html
//
// Each ES module is wrapped in its own function scope, and its exports are
// passed on to the modules after it, so nothing collides.
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const OUT = process.argv[2] ?? join(ROOT, 'dist', 'truth-or-drink.html');

// Dependency order. `ns` = the namespace name when another module does `import * as X`.
const MODULES = [
  { file: 'src/data/cards.js' },
  { file: 'src/data/rules.js' },
  { file: 'src/storage.js' },
  { file: 'src/icons.js' },
  { file: 'src/game.js', ns: 'G' },
  { file: 'src/app.js', entry: true },
];

const read = (f) => readFile(join(ROOT, f), 'utf8');

function wrap(src, { ns, entry }) {
  const names = [...src.matchAll(/^export\s+(?:async\s+)?(?:const|let|function)\s+([A-Za-z_$][\w$]*)/gm)].map((m) => m[1]);
  const body = src
    .replace(/^import\s[\s\S]*?from\s+['"][^'"]+['"];?\s*$/gm, '') // imports are satisfied by outer scope
    .replace(/^export\s+(?=(?:async\s+)?(?:const|let|function)\s)/gm, '');
  if (entry) return `(() => {\n${body}\n})();`;
  const ret = `return { ${names.join(', ')} };`;
  return ns ? `const ${ns} = (() => {\n${body}\n${ret}\n})();` : `const { ${names.join(', ')} } = (() => {\n${body}\n${ret}\n})();`;
}

const html = await read('index.html');
const css = await read('src/styles.css');
const js = (await Promise.all(MODULES.map(async (m) => `// ── ${m.file}\n${wrap(await read(m.file), m)}`))).join('\n\n');

const fonts = [...html.matchAll(/<link rel="(?:preconnect|stylesheet)" href="https:\/\/fonts\.[^>]+>/g)].map((m) => m[0]).join('\n');
const body = html.match(/<body>([\s\S]*)<\/body>/)[1];

const out = `<title>Truth or Drink</title>
<meta name="claude:viewport-fit-sides" content="cover">
<meta name="description" content="A pass-the-phone party game: answer the question honestly, or take a drink.">
${fonts}
<style>
${css.replace(/<\/style/gi, '<\\/style')}
</style>
${body.trim()}
<script>
${js.replace(/<\/script/gi, '<\\/script')}
</script>
`;

await mkdir(dirname(OUT), { recursive: true });
await writeFile(OUT, out);
console.log(`Single-file build → ${OUT} (${(out.length / 1024).toFixed(0)} KB)`);
