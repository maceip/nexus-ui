import { execFileSync } from "node:child_process";
import { readFileSync, writeFileSync } from "node:fs";

function run(command, args) {
  execFileSync(command, args, { stdio: "inherit" });
}

run("rm", ["-f", "tsconfig.tsbuildinfo"]);
run("npm", ["exec", "fumadocs-mdx"]);
run("npm", ["exec", "next", "typegen"]);

const tsconfigPath = "tsconfig.json";
const tsconfig = JSON.parse(readFileSync(tsconfigPath, "utf8"));
if (Array.isArray(tsconfig.include)) {
  tsconfig.include = tsconfig.include.filter(
    (entry) => entry !== ".next/types/**/*.ts",
  );
}
writeFileSync(tsconfigPath, `${JSON.stringify(tsconfig, null, 2)}\n`);

run("node_modules/.bin/tsc", ["--noEmit"]);
