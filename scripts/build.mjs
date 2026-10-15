// Builds one (or every) site of the monorepo into sites/<site>/dist:
//   1. copy shared/          (modules, styles, images used by both sites)
//   2. overlay sites/<site>/public/   (that site's own pages and files win)
//   3. run sites/<site>/<hook>.mjs    (pre-render HTML, sitemap, llms.txt …)
//   4. stamp every local .js/.css URL with ?v=<content hash> so browsers never
//      mix cached modules from two deployments (that silently breaks all JS)
//
//   node scripts/build.mjs portfolio | hub | all
//
// Cloudflare Pages: root directory sites/<site>, build command
// `node ../../scripts/build.mjs <site>`, output directory `dist`.
import { cp, rm, readdir, readFile, writeFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import { join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const ROOT = new URL("../", import.meta.url);
const HOOKS = { portfolio: "prerender.mjs", hub: "pages.mjs" };
const skip = src => !/(^|[\\/])(\.DS_Store|\.wrangler|node_modules)$/.test(src);

async function build(site) {
  const t = Date.now();
  const siteDir = new URL(`sites/${site}/`, ROOT);
  const dist = new URL("dist/", siteDir);
  await rm(dist, { recursive: true, force: true });
  await cp(new URL("shared/", ROOT), dist, { recursive: true, filter: skip });
  await cp(new URL("public/", siteDir), dist, { recursive: true, filter: skip });
  const hook = await import(pathToFileURL(fileURLToPath(new URL(HOOKS[site], siteDir))));
  await hook.default(dist);
  const v = await stampVersions(fileURLToPath(dist));
  const files = await countFiles(fileURLToPath(dist));
  console.log(`✓ ${site}: ${files} files, assets v=${v} → ${fileURLToPath(dist)} (${Date.now() - t} ms)`);
}

async function walk(dir, out = []) {
  for (const e of await readdir(dir, { withFileTypes: true })) {
    const p = join(dir, e.name);
    e.isDirectory() ? await walk(p, out) : out.push(p);
  }
  return out;
}

// Local module/style specifiers: ./x.js, ../x.js, /assets/x.js (not //cdn or https://).
const LOCAL = String.raw`(?:\.{1,2}/|/(?!/))[^"'?#\s]+\.(?:js|css)`;
const JS_SPEC = new RegExp(String.raw`(\bfrom\s*|\bimport\s*\(\s*|\bimport\s+)(["'])(${LOCAL})\2`, "g");
const HTML_REF = new RegExp(String.raw`(\s(?:src|href)=)(["'])(${LOCAL})\2`, "g");

async function stampVersions(dir) {
  const files = await walk(dir);
  const code = files.filter(f => /\.(js|mjs|css|html)$/.test(f) && !/[\\/](sw|_worker)\.js$/.test(f));
  const hash = createHash("sha256");
  for (const f of code.filter(f => /\.(js|css)$/.test(f)).sort()) hash.update(await readFile(f));
  const v = hash.digest("hex").slice(0, 10);
  for (const f of code) {
    const src = await readFile(f, "utf8");
    const re = f.endsWith(".html") ? HTML_REF : JS_SPEC;
    const out = src.replace(re, (_, pre, q, spec) => `${pre}${q}${spec}?v=${v}${q}`);
    if (out !== src) await writeFile(f, out);
  }
  // Guard: fail the build if any local module import was left unversioned.
  for (const f of code.filter(f => /\.js$/.test(f))) {
    const left = (await readFile(f, "utf8")).match(new RegExp(String.raw`(?:\bfrom\s*|\bimport\s*\(\s*)["']${LOCAL}["']`, "g"));
    if (left) throw new Error(`Unversioned import in ${f}: ${left[0]}`);
  }
  return v;
}

// Node 18-compatible recursive count (Cloudflare's default build image).
async function countFiles(dir) {
  let n = 0;
  for (const e of await readdir(dir, { withFileTypes: true })) n += e.isDirectory() ? await countFiles(join(dir, e.name)) : 1;
  return n;
}

const arg = process.argv[2] || "all";
const sites = arg === "all" ? Object.keys(HOOKS) : [arg];
for (const s of sites) {
  if (!HOOKS[s]) { console.error(`Unknown site "${s}". Use: ${Object.keys(HOOKS).join(" | ")} | all`); process.exit(1); }
  await build(s);
}
