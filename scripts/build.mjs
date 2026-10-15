// Builds one (or every) site of the monorepo into sites/<site>/dist:
//   1. copy shared/          (modules, styles, images used by both sites)
//   2. overlay sites/<site>/public/   (that site's own pages and files win)
//   3. run sites/<site>/<hook>.mjs    (pre-render HTML, sitemap, llms.txt …)
//
//   node scripts/build.mjs portfolio | hub | all
//
// Cloudflare Pages: root directory sites/<site>, build command
// `node ../../scripts/build.mjs <site>`, output directory `dist`.
import { cp, rm, readdir } from "node:fs/promises";
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
  const files = await countFiles(fileURLToPath(dist));
  console.log(`✓ ${site}: ${files} files → ${fileURLToPath(dist)} (${Date.now() - t} ms)`);
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
