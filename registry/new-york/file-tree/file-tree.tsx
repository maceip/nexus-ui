"use client";

import * as React from "react";
import { ChevronRightIcon, FileIcon, FolderIcon, FolderOpenIcon } from "lucide-react";

import { cn } from "@/lib/utils";

export type FileTreeNode = {
  name: string;
  children?: FileTreeNode[];
};

export type FileTreeProps = {
  tree?: FileTreeNode[];
  defaultExpanded?: boolean | string[];
  iconStyle?: "minimal" | "colored";
  highlight?: string[];
  className?: string;
};

type FlattenedTreeNode = {
  node: FileTreeNode;
  path: string;
  depth: number;
};

const DEFAULT_TREE: FileTreeNode[] = [
  {
    name: "src",
    children: [
      {
        name: "app",
        children: [{ name: "page.tsx" }, { name: "layout.tsx" }],
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

export function FileTree({
  tree = DEFAULT_TREE,
  defaultExpanded = true,
  iconStyle = "minimal",
  highlight = [],
  className,
}: FileTreeProps) {
  const defaultSet = React.useMemo(
    () => buildDefaultExpandedSet(tree, defaultExpanded),
    [defaultExpanded, tree],
  );
  const [expanded, setExpanded] = React.useState<Set<string>>(defaultSet);

  React.useEffect(() => {
    setExpanded(defaultSet);
  }, [defaultSet]);

  const flattened = React.useMemo(
    () => flattenVisibleNodes(tree, expanded),
    [expanded, tree],
  );

  return (
    <div
      role="tree"
      aria-label="File tree"
      className={cn(
        "w-full rounded-2xl border border-border bg-card p-3 shadow-sm",
        className,
      )}
    >
      <div className="space-y-1">
        {flattened.map(({ node, path, depth }) => {
          const isFolder = Boolean(node.children?.length);
          const isExpanded = expanded.has(path);
          const isHighlighted = highlight.includes(path);

          return (
            <div
              key={path}
              role="treeitem"
              aria-level={depth + 1}
              aria-expanded={isFolder ? isExpanded : undefined}
              aria-selected={isHighlighted || undefined}
              className="outline-none"
            >
              <button
                type="button"
                onClick={() => {
                  if (!isFolder) return;
                  setExpanded((current) => {
                    const next = new Set(current);
                    if (next.has(path)) {
                      next.delete(path);
                    } else {
                      next.add(path);
                    }
                    return next;
                  });
                }}
                className={cn(
                  "flex w-full items-center gap-2 rounded-xl px-2 py-1.5 text-left text-sm transition-colors",
                  "hover:bg-muted/70 focus-visible:bg-muted/80 focus-visible:outline-none",
                  isHighlighted &&
                    "bg-primary/8 text-foreground ring-1 ring-primary/15 dark:bg-primary/12",
                  !isFolder && "cursor-default",
                )}
                style={{ paddingLeft: `${depth * 14 + 8}px` }}
              >
                <span className="flex w-4 shrink-0 items-center justify-center text-muted-foreground">
                  {isFolder ? (
                    <ChevronRightIcon
                      className={cn(
                        "size-3.5 transition-transform",
                        isExpanded && "rotate-90",
                      )}
                    />
                  ) : null}
                </span>
                <TreeIcon
                  name={node.name}
                  isFolder={isFolder}
                  expanded={isExpanded}
                  iconStyle={iconStyle}
                />
                <span className="truncate">{node.name}</span>
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function TreeIcon({
  name,
  isFolder,
  expanded,
  iconStyle,
}: {
  name: string;
  isFolder: boolean;
  expanded: boolean;
  iconStyle: "minimal" | "colored";
}) {
  if (isFolder) {
    const FolderComponent = expanded ? FolderOpenIcon : FolderIcon;
    return (
      <FolderComponent
        className={cn(
          "size-4 shrink-0",
          iconStyle === "colored" ? "text-amber-500" : "text-muted-foreground",
        )}
      />
    );
  }

  return (
    <FileIcon
      className={cn(
        "size-4 shrink-0",
        iconStyle === "colored" ? fileColorClass(name) : "text-muted-foreground",
      )}
    />
  );
}

function flattenVisibleNodes(
  nodes: FileTreeNode[],
  expanded: Set<string>,
  depth = 0,
  parentPath = "",
): FlattenedTreeNode[] {
  return nodes.flatMap((node) => {
    const path = parentPath ? `${parentPath}/${node.name}` : node.name;
    const current: FlattenedTreeNode = { node, path, depth };

    if (!node.children?.length || !expanded.has(path)) {
      return [current];
    }

    return [current, ...flattenVisibleNodes(node.children, expanded, depth + 1, path)];
  });
}

function buildDefaultExpandedSet(
  nodes: FileTreeNode[],
  defaultExpanded: boolean | string[],
  parentPath = "",
) {
  const expanded = new Set<string>();

  for (const node of nodes) {
    const path = parentPath ? `${parentPath}/${node.name}` : node.name;

    if (!node.children?.length) continue;

    const shouldExpand = Array.isArray(defaultExpanded)
      ? defaultExpanded.includes(path)
      : defaultExpanded;

    if (shouldExpand) {
      expanded.add(path);
      const nested = buildDefaultExpandedSet(node.children, defaultExpanded, path);
      for (const item of nested) {
        expanded.add(item);
      }
    }
  }

  return expanded;
}

function fileColorClass(name: string) {
  const extension = name.split(".").pop()?.toLowerCase();

  switch (extension) {
    case "ts":
    case "tsx":
      return "text-sky-500";
    case "js":
    case "jsx":
      return "text-amber-500";
    case "json":
      return "text-lime-500";
    case "md":
    case "mdx":
      return "text-violet-500";
    case "css":
    case "scss":
      return "text-pink-500";
    case "py":
      return "text-emerald-500";
    case "rs":
      return "text-orange-500";
    case "go":
      return "text-cyan-500";
    case "yml":
    case "yaml":
      return "text-fuchsia-500";
    default:
      return "text-muted-foreground";
  }
}
