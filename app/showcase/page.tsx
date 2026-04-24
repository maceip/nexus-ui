"use client";

import * as React from "react";

import { ActivityGraph } from "@/components/nexus-ui/activity-graph";
import { CommitGraph, type Commit } from "@/components/nexus-ui/commit-graph";
import {
  ContextualTextInput,
  validateContextualInput,
} from "@/components/nexus-ui/contextual-text-input";
import { FileTree, type FileTreeNode } from "@/components/nexus-ui/file-tree";
import { RepoCard } from "@/components/nexus-ui/repo-card";

const repoCards = [
  {
    owner: "shadcn-ui",
    repo: "ui",
    data: {
      id: 1,
      name: "ui",
      full_name: "shadcn-ui/ui",
      html_url: "https://github.com/shadcn-ui/ui",
      description:
        "A set of beautifully-designed, accessible components and a code distribution platform. Works with your favorite frameworks. Open Source.",
      stargazers_count: 112900,
      forks_count: 8600,
      language: "TypeScript",
      topics: [
        "base-ui",
        "components",
        "laravel",
        "nextjs",
        "tailwindcss",
        "design-system",
        "radix",
        "registry",
        "open-source",
        "react",
        "shadcn",
      ],
      archived: false,
      fork: false,
      updated_at: "2026-04-23T10:30:00.000Z",
      license: {
        key: "mit",
        name: "MIT License",
        spdx_id: "MIT",
      },
      owner: {
        login: "shadcn-ui",
      },
    },
  },
  {
    owner: "vercel",
    repo: "next.js",
    variant: "outline" as const,
    data: {
      id: 2,
      name: "next.js",
      full_name: "vercel/next.js",
      html_url: "https://github.com/vercel/next.js",
      description: "The React Framework",
      stargazers_count: 139100,
      forks_count: 31000,
      language: "JavaScript",
      topics: [
        "blog",
        "browser",
        "compiler",
        "components",
        "edge",
        "framework",
        "react",
        "routing",
        "ssr",
        "vercel",
        "web",
        "webpack",
        "turbopack",
        "mdx",
      ],
      archived: false,
      fork: false,
      updated_at: "2026-04-23T10:30:00.000Z",
      license: {
        key: "mit",
        name: "MIT License",
        spdx_id: "MIT",
      },
      owner: {
        login: "vercel",
      },
    },
  },
];

const commits: Commit[] = [
  {
    hash: "a1b2c3d",
    message: "feat(auth): add OAuth2 support",
    author: { name: "Sarah Chen" },
    date: "2026-04-23T10:00:00.000Z",
    parents: ["m1e2r3g"],
    refs: ["main", "HEAD"],
    tag: "v2.1.0",
  },
  {
    hash: "m1e2r3g",
    message: "Merge branch 'feat/dashboard' into main",
    author: { name: "Sarah Chen" },
    date: "2026-04-23T06:00:00.000Z",
    parents: ["f6e5d4c", "d4a5s6h"],
  },
  {
    hash: "d4a5s6h",
    message: "feat: add analytics chart component",
    author: { name: "Jordan Lee" },
    date: "2026-04-23T04:00:00.000Z",
    parents: ["w1i2p3"],
    refs: ["feat/dashboard"],
  },
  {
    hash: "f6e5d4c",
    message: "fix(api): handle rate limit headers",
    author: { name: "Alex Rivera" },
    date: "2026-04-22T18:00:00.000Z",
    parents: ["4d5e6f1"],
  },
  {
    hash: "w1i2p3",
    message: "wip: dashboard layout skeleton",
    author: { name: "Jordan Lee" },
    date: "2026-04-21T12:00:00.000Z",
    parents: ["4d5e6f1"],
  },
  {
    hash: "4d5e6f1",
    message: "chore(deps): upgrade next to 15.5",
    author: { name: "Sarah Chen" },
    date: "2026-04-18T12:00:00.000Z",
    parents: ["0a1b2c3"],
    tag: "v2.0.0",
  },
  {
    hash: "0a1b2c3",
    message: "Initial commit",
    author: { name: "Sarah Chen" },
    date: "2026-04-09T12:00:00.000Z",
    parents: [],
  },
];

const fileTree: FileTreeNode[] = [
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

const activityData = Array.from({ length: 364 }, (_, index) => {
  const date = new Date();
  date.setDate(date.getDate() - (363 - index));

  const seasonal =
    Math.max(0, Math.sin(index / 18) * 3) +
    Math.max(0, Math.cos(index / 9) * 2) +
    (index % 29 === 0 ? 6 : 0) +
    (index % 17 === 0 ? 4 : 0);

  return {
    date: date.toISOString().slice(0, 10),
    count: Math.round(seasonal),
  };
});

export default function GalleryPage() {
  const [githubRepo, setGithubRepo] = React.useState("github.com/shadcn-ui/ui");
  const [huggingfaceRepo, setHuggingfaceRepo] = React.useState(
    "huggingface.co/google/gemma-3-1b",
  );
  const component =
    typeof window !== "undefined"
      ? new URLSearchParams(window.location.search).get("component")
      : null;
  const showAll = !component;
  const githubValidation = validateContextualInput("github", githubRepo);
  const huggingfaceValidation = validateContextualInput(
    "huggingface",
    huggingfaceRepo,
  );

  return (
    <main className="min-h-screen bg-[#050505] px-6 py-14 text-white sm:px-8 lg:px-12">
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-14">
        {showAll ? (
          <header className="space-y-3">
          <p className="text-sm font-medium uppercase tracking-[0.22em] text-white/45">
            Nexus UI Gallery
          </p>
          <h1 className="text-3xl font-semibold tracking-[-0.04em] sm:text-4xl">
            Component showcase
          </h1>
          <p className="max-w-2xl text-base text-white/62">
            A deploy-friendly gallery page for the repository insights components
            and the rest of the Nexus UI component set.
          </p>
          </header>
        ) : null}

        {showAll || component === "repo-card" ? (
          <section className="space-y-6">
          <SectionTitle
            title="Repo cards"
            description="Dark GitHub-style repository previews with compact metadata rows."
          />
            <div
              data-testid="repo-card-preview"
              className="grid gap-5 lg:grid-cols-2"
            >
            {repoCards.map((card) => (
              <RepoCard
                key={card.data.full_name}
                owner={card.owner}
                repo={card.repo}
                variant={card.variant}
                data={card.data}
              />
            ))}
          </div>
          </section>
        ) : null}

        {showAll || component === "commit-graph" ? (
          <section className="space-y-6">
          <SectionTitle
            title="Commit graph"
            description="Compact topology-first commit list with rails, refs, avatars, and relative timestamps."
          />
            <div data-testid="commit-graph-preview">
              <CommitGraph commits={commits} />
            </div>
          </section>
        ) : null}

        {showAll || component === "activity-graph" ? (
          <section className="space-y-6">
          <SectionTitle
            title="Activity graph"
            description="GitHub-like contribution heatmap plus the side-scrolling loading mode."
          />
            <div
              data-testid="activity-graph-preview"
              className="space-y-6"
            >
            <ActivityGraph data={activityData} />
            <ActivityGraph data={[]} loading className="max-w-[1000px]" />
          </div>
          </section>
        ) : null}

        {showAll || component === "contextual-inputs" ? (
          <section className="space-y-6">
          <SectionTitle
            title="Contextual inputs"
            description="Context-specific GitHub and Hugging Face input shells with anchored icons and built-in validation."
          />
            <div
              data-testid="contextual-inputs-preview"
              className="grid gap-5 lg:grid-cols-2"
            >
              <ContextualTextInput
                kind="github"
                value={githubRepo}
                onChange={setGithubRepo}
              />
              <ContextualTextInput
                kind="huggingface"
                value={huggingfaceRepo}
                onChange={setHuggingfaceRepo}
              />
            </div>
            <div className="grid gap-4 rounded-2xl border border-white/8 bg-white/[0.02] p-4 text-sm text-white/72 lg:grid-cols-2">
              <div>
                <p className="font-medium text-white">GitHub normalized</p>
                <p>{githubValidation.normalizedValue ?? "Invalid repo"}</p>
              </div>
              <div>
                <p className="font-medium text-white">Hugging Face normalized</p>
                <p>{huggingfaceValidation.normalizedValue ?? "Invalid repo"}</p>
              </div>
            </div>
          </section>
        ) : null}

        {showAll || component === "file-tree" ? (
          <section className="space-y-6">
          <SectionTitle
            title="File tree"
            description="Tighter, darker file-tree presentation for repository layouts."
          />
            <div data-testid="file-tree-preview" className="max-w-xl">
            <FileTree
              tree={fileTree}
              iconStyle="colored"
              highlight={["src/app/page.tsx", "src/lib/utils.ts"]}
              defaultExpanded={["src", "src/app", "src/lib"]}
            />
          </div>
          </section>
        ) : null}
      </div>
    </main>
  );
}

function SectionTitle({
  title,
  description,
}: {
  title: string;
  description: string;
}) {
  return (
    <div className="space-y-2">
      <h2 className="text-xl font-semibold tracking-[-0.03em]">{title}</h2>
      <p className="text-sm text-white/58">{description}</p>
    </div>
  );
}
