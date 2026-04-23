"use server";

import { RepoCard, fetchGitHubRepo } from "@/components/nexus-ui/repo-card";

const exampleRepo = {
  id: 1,
  name: "nexus-ui",
  full_name: "maceip/nexus-ui",
  html_url: "https://github.com/maceip/nexus-ui",
  description:
    "Design-first AI UI primitives for building composable chat, model, and workflow experiences.",
  stargazers_count: 1284,
  forks_count: 164,
  language: "TypeScript",
  topics: ["design-system", "ai", "shadcn", "components", "nextjs"],
  archived: false,
  fork: false,
  updated_at: "2026-04-20T12:00:00.000Z",
  license: {
    key: "mit",
    name: "MIT License",
    spdx_id: "MIT",
  },
  owner: {
    login: "maceip",
    avatar_url: "https://github.com/maceip.png",
    html_url: "https://github.com/maceip",
  },
};

export default async function RepoCardDefault() {
  const repoData = await fetchGitHubRepo("maceip", "nexus-ui");

  return (
    <div className="w-full max-w-xl">
      <RepoCard owner="maceip" repo="nexus-ui" data={repoData ?? exampleRepo} />
    </div>
  );
}
