// Generates build/sitemap.xml from the canonical urls in the built pages.
import { readdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const buildDir = "build";

function* htmlFiles(dir) {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) yield* htmlFiles(path);
    else if (entry.name === "index.html") yield path;
  }
}

const entries = [];
for (const file of htmlFiles(buildDir)) {
  const html = readFileSync(file, "utf8");
  const loc = html.match(/<link rel="canonical" href="([^"]+)"/)?.[1];
  if (!loc) continue;
  const lastmod = html.match(/<meta property="article:published_time" content="([^"]+)"/)?.[1];
  entries.push({ loc, lastmod });
}
entries.sort((a, b) => a.loc.localeCompare(b.loc));

const urls = entries
  .map(({ loc, lastmod }) => `  <url><loc>${loc}</loc>${lastmod ? `<lastmod>${lastmod}</lastmod>` : ""}</url>`)
  .join("\n");

writeFileSync(
  join(buildDir, "sitemap.xml"),
  `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls}\n</urlset>\n`,
);
console.log(`sitemap.xml: ${entries.length} urls`);
