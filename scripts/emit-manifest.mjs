#!/usr/bin/env node
// Writes manifest.json next to dist/ for Paperclip to pick up at install time.
import { writeFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const manifestModule = await import(resolve(here, "../dist/manifest.js"));
const manifest = manifestModule.default;

writeFileSync(
  resolve(here, "../manifest.json"),
  JSON.stringify(manifest, null, 2) + "\n",
  "utf8",
);
console.log(`wrote manifest.json (id=${manifest.id}, version=${manifest.version})`);
