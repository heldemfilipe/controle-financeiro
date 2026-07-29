#!/usr/bin/env node
/**
 * Bump package.json version from the conventional-commit type of the commit
 * that was just made, then folds the bump into that same commit.
 * Invoked by the post-commit git hook (see scripts/hooks/post-commit).
 *
 * Runs as post-commit (not commit-msg) because by the time commit-msg
 * fires, git has already written the commit's tree — files staged there
 * land as a dangling uncommitted diff on top of HEAD instead of inside it.
 * post-commit + `commit --amend` is the reliable way to include the bump.
 *
 *   feat:            -> minor bump (x.Y.0)
 *   fix / chore /
 *   refactor / etc.  -> patch bump (x.y.Z)
 *   type!: or a
 *   BREAKING CHANGE
 *   footer           -> major bump (X.0.0)
 */
const fs = require("fs");
const path = require("path");
const { execSync } = require("child_process");

// Evita loop infinito: o próprio `commit --amend` abaixo dispara este hook de novo.
if (process.env.VERSION_BUMP_IN_PROGRESS) process.exit(0);

const repoRoot = execSync("git rev-parse --show-toplevel").toString().trim();
const pkgPath = path.join(repoRoot, "package.json");
const lockPath = path.join(repoRoot, "package-lock.json");

const message = execSync("git log -1 --pretty=%B", { cwd: repoRoot }).toString();
const subject = message.split("\n")[0].trim();

// Ignora merges, reverts e mensagens vazias — não representam trabalho novo.
if (!subject || /^(merge|revert)\b/i.test(subject)) process.exit(0);

const isBreaking = /^\w+(\([^)]*\))?!:/.test(subject) || /BREAKING CHANGE/.test(message);
const isFeat = /^feat(\([^)]*\))?:/.test(subject);

const pkg = JSON.parse(fs.readFileSync(pkgPath, "utf8"));
let [major, minor, patch] = pkg.version.split(".").map(Number);

if (isBreaking) { major += 1; minor = 0; patch = 0; }
else if (isFeat) { minor += 1; patch = 0; }
else { patch += 1; }

const nextVersion = `${major}.${minor}.${patch}`;
if (nextVersion === pkg.version) process.exit(0);

pkg.version = nextVersion;
fs.writeFileSync(pkgPath, JSON.stringify(pkg, null, 2) + "\n");

const lockExists = fs.existsSync(lockPath);
if (lockExists) {
  const lock = JSON.parse(fs.readFileSync(lockPath, "utf8"));
  lock.version = nextVersion;
  if (lock.packages && lock.packages[""]) lock.packages[""].version = nextVersion;
  fs.writeFileSync(lockPath, JSON.stringify(lock, null, 2) + "\n");
}

const filesToAdd = [pkgPath, lockExists ? lockPath : null].filter(Boolean);
execSync(`git add ${filesToAdd.map(f => `"${f}"`).join(" ")}`, { cwd: repoRoot });
execSync("git commit --amend --no-edit --no-verify", {
  cwd: repoRoot,
  env: Object.assign({}, process.env, { VERSION_BUMP_IN_PROGRESS: "1" }),
});

console.log(`[version] v${nextVersion} (${isBreaking ? "major" : isFeat ? "minor" : "patch"}) — ${subject}`);
