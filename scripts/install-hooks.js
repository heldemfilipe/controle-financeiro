#!/usr/bin/env node
/**
 * Copies scripts/hooks/* into .git/hooks so version bumping (bump-version.js)
 * runs automatically on every commit. Runs on `npm install` via the
 * "prepare" script — no dependency on husky or similar needed.
 */
const fs = require("fs");
const path = require("path");
const { execSync } = require("child_process");

let repoRoot;
try {
  repoRoot = execSync("git rev-parse --show-toplevel").toString().trim();
} catch {
  process.exit(0); // não é um checkout git (ex.: instalação a partir de tarball)
}

const hooksDir = path.join(repoRoot, ".git", "hooks");
const srcDir = path.join(repoRoot, "scripts", "hooks");

if (!fs.existsSync(hooksDir) || !fs.existsSync(srcDir)) process.exit(0);

for (const name of fs.readdirSync(srcDir)) {
  const dest = path.join(hooksDir, name);
  fs.copyFileSync(path.join(srcDir, name), dest);
  fs.chmodSync(dest, 0o755);
}

console.log("[hooks] git hooks instalados (post-commit bump automático de versão)");
