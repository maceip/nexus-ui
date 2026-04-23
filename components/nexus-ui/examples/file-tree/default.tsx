"use client";

import * as React from "react";

import { FileTree, type FileTreeNode } from "@/components/nexus-ui/file-tree";

const tree: FileTreeNode[] = [
  {
    name: "src",
    children: [
      {
        name: "app",
        children: [
          { name: "layout.tsx" },
          { name: "page.tsx" },
          { name: "api", children: [{ name: "route.ts" }] },
        ],
      },
      {
        name: "components",
        children: [{ name: "header.tsx" }, { name: "footer.tsx" }],
      },
      { name: "lib", children: [{ name: "utils.ts" }] },
    ],
  },
  { name: "package.json" },
  { name: "README.md" },
];

export default function FileTreeExample() {
  return (
    <div className="w-full max-w-xl">
      <FileTree
        tree={tree}
        iconStyle="colored"
        highlight={["src/app/page.tsx", "src/lib/utils.ts"]}
        defaultExpanded={["src", "src/app", "src/lib"]}
      />
    </div>
  );
}
