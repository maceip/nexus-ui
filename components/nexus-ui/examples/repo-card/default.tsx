"use server";

import { RepoCard } from "@/components/nexus-ui/repo-card";

const shadcnUiRepo = {
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
    "radix",
    "tailwindcss",
    "typescript",
    "registry",
    "design-system",
    "react",
    "open-source",
  ],
  archived: false,
  fork: false,
  updated_at: new Date().toISOString(),
  license: {
    key: "mit",
    name: "MIT License",
    spdx_id: "MIT",
  },
  owner: {
    login: "shadcn-ui",
    avatar_url: "https://github.com/shadcn-ui.png",
    html_url: "https://github.com/shadcn-ui",
  },
};

const nextJsRepo = {
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
    "server-components",
    "ssr",
    "webpack",
    "vercel",
    "routing",
    "app-router",
    "typescript",
  ],
  archived: false,
  fork: false,
  updated_at: new Date().toISOString(),
  license: {
    key: "mit",
    name: "MIT License",
    spdx_id: "MIT",
  },
  owner: {
    login: "vercel",
    avatar_url: "https://github.com/vercel.png",
    html_url: "https://github.com/vercel",
  },
};

export default async function RepoCardDefault() {
  return (
    <div className="mx-auto flex w-full max-w-[860px] flex-col gap-8">
      <RepoCard owner="shadcn-ui" repo="ui" data={shadcnUiRepo} />
      <RepoCard owner="vercel" repo="next.js" variant="outline" data={nextJsRepo} />
    </div>
  );
}
