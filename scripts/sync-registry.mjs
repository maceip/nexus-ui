#!/usr/bin/env node
/**
 * Syncs local component files back to the registry.
 * Reads registry.json and copies from target (components) to path (registry).
 */
import { readFileSync, writeFileSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, "..");
const registry = JSON.parse(
  readFileSync(join(root, "registry.json"), "utf-8"),
);

for (const item of registry.items) {
  for (const file of item.files || []) {
    if (file.target && file.path) {
      const src = join(root, file.target.replace(/^~\//, ""));
      const dest = join(root, file.path);
      try {
        const content = readFileSync(src, "utf-8");
        writeFileSync(dest, content);
        console.log(`✓ ${file.target} → ${file.path}`);
      } catch (err) {
        console.error(`✗ ${file.target}: ${err.message}`);
      }
    }
  }
}
