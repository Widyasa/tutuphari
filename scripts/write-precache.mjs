import { readdir, stat, writeFile } from "node:fs/promises";
import path from "node:path";

const root = path.join(process.cwd(), ".next", "static");
const urls = [];

async function walk(dir) {
  let entries = [];
  try {
    entries = await readdir(dir);
  } catch {
    return;
  }
  for (const name of entries) {
    const full = path.join(dir, name);
    const info = await stat(full);
    if (info.isDirectory()) {
      await walk(full);
      continue;
    }
    if (name.endsWith(".map")) continue;
    const rel = path.relative(root, full).split(path.sep).join("/");
    urls.push(`/_next/static/${rel}`);
  }
}

await walk(root);
urls.sort();
await writeFile(path.join(process.cwd(), "public", "precache.json"), `${JSON.stringify(urls)}\n`);
console.log(`precache ${urls.length} files`);
