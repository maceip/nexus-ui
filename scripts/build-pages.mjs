#!/usr/bin/env node

import { cpSync, existsSync, mkdirSync, readdirSync, rmSync, statSync, writeFileSync } from "fs";
import { join } from "path";

const root = process.cwd();
const outDir = join(root, "out");
const nextAppDir = join(root, ".next", "server", "app");
const nextStaticDir = join(root, ".next", "static");
const publicDir = join(root, "public");

rmSync(outDir, { recursive: true, force: true });
mkdirSync(outDir, { recursive: true });

if (!existsSync(nextAppDir)) {
  console.error("Missing .next/server/app after build.");
  process.exit(1);
}

copyRenderedTree(nextAppDir, outDir);

if (existsSync(nextStaticDir)) {
  cpSync(nextStaticDir, join(outDir, "_next", "static"), { recursive: true });
}

if (existsSync(publicDir)) {
  copyPublicAssets(publicDir, outDir);
}

writeFileSync(join(outDir, ".nojekyll"), "");

console.log("✓ Materialized static Pages artifact in out/");

function copyRenderedTree(sourceDir, targetDir) {
  cpSync(sourceDir, targetDir, {
    recursive: true,
    filter: (source) => {
      const name = source.split("/").pop() ?? "";

      if (name === "api") return false;
      if (name === "_global-error.rsc" || name === "_global-error.meta") return false;
      if (name.endsWith(".rsc") || name.endsWith(".meta") || name.endsWith(".segments")) {
        return false;
      }

      return true;
    },
  });

  normalizeHtmlOutputs(targetDir);
}

function normalizeHtmlOutputs(dir) {
  const entries = listFiles(dir);

  for (const file of entries) {
    if (!file.endsWith(".html")) continue;

    if (file.endsWith("index.html") || file.endsWith("404.html")) {
      continue;
    }

    const absolute = join(dir, file);
    const routeName = file.slice(0, -".html".length);
    const routeDir = join(dir, routeName);
    mkdirSync(routeDir, { recursive: true });
    cpSync(absolute, join(routeDir, "index.html"));
  }

  const notFoundHtml = join(dir, "_not-found.html");
  if (existsSync(notFoundHtml)) {
    cpSync(notFoundHtml, join(dir, "404.html"));
  }
}

function copyPublicAssets(sourceDir, targetDir) {
  const entries = listFiles(sourceDir);

  for (const relativePath of entries) {
    const source = join(sourceDir, relativePath);
    const target = join(targetDir, relativePath);
    if (existsSync(target)) {
      continue;
    }
    const parent = target.split("/").slice(0, -1).join("/");
    mkdirSync(parent, { recursive: true });
    cpSync(source, target);
  }
}

function listFiles(dir, prefix = "") {
  const entries = readdirSync(join(dir, prefix));
  const files = [];

  for (const entry of entries) {
    const relativePath = prefix ? `${prefix}/${entry}` : entry;
    const absolutePath = join(dir, relativePath);
    const stat = statSync(absolutePath);

    if (stat.isDirectory()) {
      files.push(...listFiles(dir, relativePath));
    } else {
      files.push(relativePath);
    }
  }

  return files;
}
