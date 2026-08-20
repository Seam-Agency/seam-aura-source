import { execFileSync } from "node:child_process";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

const temporaryDirectory = await mkdtemp(join(tmpdir(), "seam-aura-consumer-"));

try {
  const packedOutput = execFileSync(
    "npm",
    ["pack", "--silent", "--json", "--pack-destination", temporaryDirectory],
    { encoding: "utf8", shell: process.platform === "win32" },
  );
  const [{ filename }] = JSON.parse(packedOutput);
  const archive = join(temporaryDirectory, filename);

  await writeFile(
    join(temporaryDirectory, "package.json"),
    JSON.stringify({ private: true, type: "module" }),
  );
  execFileSync(
    "npm",
    [
      "install",
      "--ignore-scripts",
      "--no-audit",
      "--no-fund",
      archive,
      "react@19.2.8",
      "react-dom@19.2.8",
    ],
    {
      cwd: temporaryDirectory,
      stdio: "inherit",
      shell: process.platform === "win32",
    },
  );

  await writeFile(
    join(temporaryDirectory, "verify.mjs"),
    `
      import React from "react";
      import { renderToStaticMarkup } from "react-dom/server";
      import { SeamAura, DEFAULT_PULSE_ORIGIN } from "@seam-agency/seam-aura";

      if (DEFAULT_PULSE_ORIGIN[0] !== 1.001) throw new Error("Unexpected pulse origin");
      const html = renderToStaticMarkup(React.createElement(SeamAura, null, "Ready"));
      if (!html.includes("seam-aura") || !html.includes("Ready")) {
        throw new Error("Consumer render failed");
      }
    `,
  );
  execFileSync("node", ["verify.mjs"], {
    cwd: temporaryDirectory,
    stdio: "inherit",
  });

  const installedPackage = JSON.parse(
    await readFile(
      join(
        temporaryDirectory,
        "node_modules",
        "@seam-agency",
        "seam-aura",
        "package.json",
      ),
      "utf8",
    ),
  );
  if (installedPackage.name !== "@seam-agency/seam-aura") {
    throw new Error("Installed package identity mismatch.");
  }

  console.log("Consumer smoke test passed.");
} finally {
  await rm(temporaryDirectory, { recursive: true, force: true });
}
