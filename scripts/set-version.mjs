// Applies one version everywhere so desktop, mobile and the release agree.
import { readFileSync, writeFileSync } from "node:fs";

const version = process.argv[2];
if (!version || !/^\d+\.\d+\.\d+$/.test(version)) {
  console.error("usage: node scripts/set-version.mjs <major.minor.patch>");
  process.exit(1);
}

const files = [
  "package.json",
  "src-tauri/tauri.conf.json",
  "mobile/package.json",
  "mobile/src-tauri/tauri.conf.json",
];

for (const file of files) {
  const json = JSON.parse(readFileSync(file, "utf8"));
  json.version = version;
  writeFileSync(file, `${JSON.stringify(json, null, 2)}\n`);
  console.log(`set ${file} -> ${version}`);
}
