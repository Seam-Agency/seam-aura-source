import { readdir, readFile, stat } from "node:fs/promises";
import { join, relative } from "node:path";
import { fileURLToPath } from "node:url";

const root = new URL("../", import.meta.url);
const rootPath = fileURLToPath(root);
const packageJson = JSON.parse(await readFile(new URL("package.json", root), "utf8"));
const required = [
  "dist/index.js",
  "dist/index.d.ts",
  "dist/styles.css",
];

if (packageJson.scripts?.["build:demo"]) {
  required.push("site-dist/index.html");
}

for (const path of required) {
  await stat(new URL(path, root));
}

async function listFiles(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  const files = [];

  for (const entry of entries) {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) files.push(...(await listFiles(path)));
    else files.push(path);
  }

  return files;
}

const outputDirectories = [
  fileURLToPath(new URL("dist/", root)),
];
if (packageJson.scripts?.["build:demo"]) {
  outputDirectories.push(fileURLToPath(new URL("site-dist/", root)));
}
const outputFiles = (
  await Promise.all(outputDirectories.map((directory) => listFiles(directory)))
).flat();

const maps = outputFiles.filter((path) => path.endsWith(".map"));
if (maps.length > 0) {
  throw new Error(`Source maps are not publishable:\n${maps.join("\n")}`);
}

const libraryEntry = new URL("dist/index.js", root);
const librarySize = (await stat(libraryEntry)).size;
if (librarySize > 120_000) {
  throw new Error(`Library entry exceeds 120 kB: ${librarySize} bytes`);
}

if (packageJson.publishConfig?.registry !== "https://npm.pkg.github.com") {
  throw new Error("publishConfig.registry must remain pinned to GitHub Packages.");
}

const relativeOutputs = outputFiles.map((path) =>
  relative(rootPath, path),
);
console.log(
  `Distribution OK: ${relativeOutputs.length} output files, ${librarySize} byte library entry.`,
);
