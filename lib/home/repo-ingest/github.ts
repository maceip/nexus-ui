import { resolveCatalogMatch } from "@/lib/home/repo-ingest/catalog";
import {
  getBucketById,
  getLanguageProfile,
  type AuthMode,
  type BucketGroup,
  type BucketId,
  type BucketModuleMatch,
  type LanguageProfile,
  type ManifestScan,
  type RepoActivityEntry,
  type RepoCommitSummary,
  type RepoFileTreeNode,
  type RepoSummary,
  type RepoScanResult,
  type RepoSuggestion,
} from "@/lib/home/repo-ingest/shared";

const GITHUB_API_URL = "https://api.github.com";

const RECENT_REPOS_QUERY = `
  query RecentRepos($first: Int!) {
    viewer {
      repositories(
        first: $first
        orderBy: { field: PUSHED_AT, direction: DESC }
        ownerAffiliations: [OWNER, COLLABORATOR, ORGANIZATION_MEMBER]
      ) {
        nodes {
          id
          name
          nameWithOwner
          description
          pushedAt
          isPrivate
          defaultBranchRef {
            name
          }
          owner {
            login
          }
        }
      }
    }
  }
`;

type FetchJsonOptions = {
  token?: string;
  method?: "GET" | "POST";
  body?: string;
};

type GitHubTreeResponse = {
  tree?: Array<{
    path: string;
    type: "blob" | "tree";
  }>;
};

type GitHubContentResponse = {
  content?: string;
};

type GitHubRepoResponse = {
  id: number;
  name: string;
  full_name: string;
  html_url: string;
  description: string | null;
  stargazers_count: number;
  forks_count: number;
  language: string | null;
  topics?: string[];
  archived: boolean;
  fork: boolean;
  updated_at: string;
  license: {
    key: string | null;
    name: string | null;
    spdx_id?: string | null;
  } | null;
  owner: {
    login: string;
    avatar_url?: string;
    html_url?: string;
  };
  default_branch: string;
};

type GitHubCommitResponse = Array<{
  sha: string;
  commit: {
    message: string;
    author?: {
      name?: string | null;
      date?: string | null;
    } | null;
  };
  author?: {
    avatar_url?: string;
  } | null;
  parents: Array<{ sha: string }>;
}>;

type ModuleCandidate = {
  moduleName: string;
  languageKey: LanguageProfile["key"];
  manifestPath: string;
};

const SUPPORTED_MANIFESTS: Array<{
  manifestName: string;
  languageKey: LanguageProfile["key"];
}> = [
  { manifestName: "package.json", languageKey: "javascript" },
  { manifestName: "package-lock.json", languageKey: "javascript" },
  { manifestName: "tsconfig.json", languageKey: "typescript" },
  { manifestName: "deno.json", languageKey: "typescript" },
  { manifestName: "requirements.txt", languageKey: "python" },
  { manifestName: "pyproject.toml", languageKey: "python" },
  { manifestName: "Pipfile", languageKey: "python" },
  { manifestName: "pom.xml", languageKey: "java" },
  { manifestName: "build.gradle", languageKey: "java" },
  { manifestName: "build.gradle.kts", languageKey: "kotlin" },
  { manifestName: "Cargo.toml", languageKey: "rust" },
  { manifestName: "go.mod", languageKey: "go" },
  { manifestName: "composer.json", languageKey: "php" },
  { manifestName: "Gemfile", languageKey: "ruby" },
  { manifestName: "Podfile", languageKey: "swift" },
  { manifestName: "Package.swift", languageKey: "swift" },
  { manifestName: "DESCRIPTION", languageKey: "r" },
  { manifestName: "*.sql", languageKey: "sql" },
  { manifestName: "*.c", languageKey: "c" },
  { manifestName: "*.h", languageKey: "c" },
  { manifestName: "*.cpp", languageKey: "cpp" },
  { manifestName: "*.hpp", languageKey: "cpp" },
  { manifestName: "*.csproj", languageKey: "csharp" },
  { manifestName: "*.sln", languageKey: "csharp" },
];

function getGitHubToken(token: string | undefined, authMode: AuthMode) {
  if (authMode === "backup") {
    return process.env.GITHUB_BACKUP_PAT ?? token;
  }

  return token;
}

async function fetchGitHubJson<T>(
  path: string,
  { token, method = "GET", body }: FetchJsonOptions,
): Promise<T> {
  const headers: Record<string, string> = {
    Accept: "application/vnd.github+json",
    "Content-Type": "application/json",
    "User-Agent": "nexus-ui-repo-ingest",
  };

  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

  const response = await fetch(`${GITHUB_API_URL}${path}`, {
    method,
    headers,
    body,
    cache: "no-store",
  });

  if (!response.ok) {
    const message = await response.text();
    throw new Error(`GitHub request failed (${response.status}): ${message}`);
  }

  return (await response.json()) as T;
}

export async function fetchRecentRepos(
  token: string,
  authMode: AuthMode,
): Promise<RepoSuggestion[]> {
  const resolvedToken = getGitHubToken(token, authMode);
  if (!resolvedToken) {
    throw new Error("A GitHub personal access token is required.");
  }

  const payload = await fetchGitHubJson<{
    data?: {
      viewer?: {
        repositories?: {
          nodes?: Array<{
            id: string;
            name: string;
            nameWithOwner: string;
            description: string | null;
            pushedAt: string;
            isPrivate: boolean;
            defaultBranchRef?: { name: string } | null;
            owner: { login: string };
          }>;
        };
      };
    };
    errors?: Array<{ message: string }>;
  }>("/graphql", {
    token: resolvedToken,
    method: "POST",
    body: JSON.stringify({
      query: RECENT_REPOS_QUERY,
      variables: { first: 10 },
    }),
  });

  if (payload.errors?.length) {
    throw new Error(payload.errors.map((error) => error.message).join(", "));
  }

  const repositories = payload.data?.viewer?.repositories?.nodes ?? [];
  return repositories.map((repo, index) => ({
    id: Number(repo.id.replace(/\D+/g, "").slice(-9) || index + 1),
    fullName: repo.nameWithOwner,
    owner: repo.owner.login,
    name: repo.name,
    description: repo.description,
    pushedAt: repo.pushedAt,
    private: repo.isPrivate,
    defaultBranch: repo.defaultBranchRef?.name ?? "main",
  }));
}

async function fetchRepositoryTree(
  token: string,
  repoFullName: string,
  branch: string,
) {
  return fetchGitHubJson<GitHubTreeResponse>(
    `/repos/${repoFullName}/git/trees/${encodeURIComponent(branch)}?recursive=1`,
    { token },
  );
}

async function fetchRepositoryContent(
  token: string,
  repoFullName: string,
  path: string,
) {
  return fetchGitHubJson<GitHubContentResponse>(
    `/repos/${repoFullName}/contents/${path}`,
    { token },
  );
}

async function fetchRepositoryCommits(
  token: string,
  repoFullName: string,
  branch: string,
) {
  return fetchGitHubJson<GitHubCommitResponse>(
    `/repos/${repoFullName}/commits?sha=${encodeURIComponent(branch)}&per_page=6`,
    { token },
  );
}

function isSupportedManifest(path: string) {
  const lowerPath = path.toLowerCase();
  return SUPPORTED_MANIFESTS.some(({ manifestName }) => {
    if (manifestName.startsWith("*.")) {
      return lowerPath.endsWith(manifestName.slice(1).toLowerCase());
    }

    return (
      lowerPath.endsWith(`/${manifestName.toLowerCase()}`) ||
      lowerPath === manifestName.toLowerCase()
    );
  });
}

function resolveManifestLanguage(
  path: string,
): LanguageProfile["key"] | null {
  const lowerPath = path.toLowerCase();
  const exact = SUPPORTED_MANIFESTS.find(({ manifestName }) => {
    if (manifestName.startsWith("*.")) return false;
    return (
      lowerPath.endsWith(`/${manifestName.toLowerCase()}`) ||
      lowerPath === manifestName.toLowerCase()
    );
  });
  if (exact) return exact.languageKey;

  const patternMatch = SUPPORTED_MANIFESTS.find(({ manifestName }) => {
    if (!manifestName.startsWith("*.")) return false;
    return lowerPath.endsWith(manifestName.slice(1).toLowerCase());
  });
  return patternMatch?.languageKey ?? null;
}

function decodeBase64Content(content?: string) {
  if (!content) return "";
  return Buffer.from(content, "base64").toString("utf-8");
}

function parsePackageJson(source: string) {
  const parsed = JSON.parse(source) as {
    dependencies?: Record<string, string>;
    devDependencies?: Record<string, string>;
    peerDependencies?: Record<string, string>;
    optionalDependencies?: Record<string, string>;
  };

  return [
    ...Object.keys(parsed.dependencies ?? {}),
    ...Object.keys(parsed.devDependencies ?? {}),
    ...Object.keys(parsed.peerDependencies ?? {}),
    ...Object.keys(parsed.optionalDependencies ?? {}),
  ];
}

function parseRequirementsTxt(source: string) {
  return source
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line && !line.startsWith("#"))
    .map((line) => line.split(/[<=>~! ]/)[0]?.trim())
    .filter(Boolean) as string[];
}

function parseTomlStyleAssignments(source: string) {
  const modules = new Set<string>();
  for (const match of source.matchAll(/^\s*([A-Za-z0-9._-]+)\s*=\s*["{]/gm)) {
    modules.add(match[1]);
  }
  return [...modules];
}

function parsePomXml(source: string) {
  const modules = new Set<string>();
  for (const match of source.matchAll(/<artifactId>([^<]+)<\/artifactId>/g)) {
    const name = match[1]?.trim();
    if (name) modules.add(name);
  }
  return [...modules];
}

function parseGradle(source: string) {
  const modules = new Set<string>();
  for (const match of source.matchAll(
    /['"]([@A-Za-z0-9._-]+:[@A-Za-z0-9._-]+)(?::[@A-Za-z0-9+._-]+)?['"]/g,
  )) {
    const identifier = match[1];
    const moduleName = identifier.split(":")[1] ?? identifier;
    modules.add(moduleName);
  }
  return [...modules];
}

function parseGoMod(source: string) {
  return source
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line.startsWith("require "))
    .flatMap((line) => {
      const direct = line.replace(/^require\s+/, "").split(" ")[0];
      return direct ? [direct.split("/").pop() ?? direct] : [];
    });
}

function parseComposerJson(source: string) {
  const parsed = JSON.parse(source) as {
    require?: Record<string, string>;
    "require-dev"?: Record<string, string>;
  };

  return [
    ...Object.keys(parsed.require ?? {}),
    ...Object.keys(parsed["require-dev"] ?? {}),
  ];
}

function parseGemfile(source: string) {
  return [...source.matchAll(/^\s*gem\s+["']([^"']+)["']/gm)].map(
    (match) => match[1],
  );
}

function parseSwiftPackage(source: string) {
  return [...source.matchAll(/package\(url:\s*"[^"]*\/([^/"#]+?)(?:\.git)?"/g)].map(
    (match) => match[1],
  );
}

function parseDescription(source: string) {
  const importsLine = source.match(/^Imports:\s*(.+)$/m)?.[1];
  if (!importsLine) return [];
  return importsLine
    .split(",")
    .map((entry) => entry.trim())
    .filter(Boolean);
}

function parseXmlReferenceList(source: string, tagName: string) {
  return [
    ...source.matchAll(new RegExp(`<${tagName}>([^<]+)</${tagName}>`, "g")),
  ].map((match) => match[1].trim());
}

function parseModulesByManifest(path: string, source: string): string[] {
  const fileName = path.split("/").pop() ?? path;

  try {
    if (fileName === "package.json") return parsePackageJson(source);
    if (fileName === "package-lock.json") return parsePackageJson(source);
    if (fileName === "requirements.txt") return parseRequirementsTxt(source);
    if (fileName === "pyproject.toml" || fileName === "Pipfile") {
      return parseTomlStyleAssignments(source);
    }
    if (fileName === "pom.xml") return parsePomXml(source);
    if (fileName === "build.gradle" || fileName === "build.gradle.kts") {
      return parseGradle(source);
    }
    if (fileName === "Cargo.toml") return parseTomlStyleAssignments(source);
    if (fileName === "go.mod") return parseGoMod(source);
    if (fileName === "composer.json") return parseComposerJson(source);
    if (fileName === "Gemfile") return parseGemfile(source);
    if (fileName === "Podfile") return parseXmlReferenceList(source, "pod");
    if (fileName === "Package.swift") return parseSwiftPackage(source);
    if (fileName === "DESCRIPTION") return parseDescription(source);
    if (path.endsWith(".csproj")) {
      return parseXmlReferenceList(source, "PackageReference");
    }
    if (path.endsWith(".sln")) {
      return [...source.matchAll(/Project\(".*"\)\s*=\s*"[^"]+",\s*"([^"]+)"/g)].map(
        (match) => match[1],
      );
    }
  } catch {
    return [];
  }

  return [];
}

function buildManifestScan(path: string, modules: string[]): ManifestScan {
  const languageKey = resolveManifestLanguage(path);
  if (!languageKey) {
    throw new Error(`Unsupported manifest path: ${path}`);
  }

  return {
    languageKey,
    manifestPath: path,
    modules: [...new Set(modules.map((entry) => entry.trim()).filter(Boolean))].sort(
      (a, b) => a.localeCompare(b),
    ),
  };
}

function toModuleMatch(candidate: ModuleCandidate): BucketModuleMatch | null {
  const catalogMatch = resolveCatalogMatch(candidate.moduleName);
  if (!catalogMatch) {
    return null;
  }

  return {
    bucketId: catalogMatch.bucketId,
    moduleName: candidate.moduleName,
    displayName: catalogMatch.displayName,
    description: catalogMatch.description,
    languageKey: candidate.languageKey,
    manifestPath: candidate.manifestPath,
    layer: catalogMatch.layer,
    matchKind: catalogMatch.matchKind,
    icon: catalogMatch.icon,
  };
}

function bucketizeMatches(matches: BucketModuleMatch[]): BucketGroup[] {
  const grouped = new Map<BucketId, BucketModuleMatch[]>();
  for (const match of matches) {
    const existing = grouped.get(match.bucketId) ?? [];
    existing.push(match);
    grouped.set(match.bucketId, existing);
  }

  return [...grouped.entries()]
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([bucketId, modules]) => ({
      bucket: getBucketById(bucketId),
      modules: dedupeMatches(modules).sort((left, right) =>
        left.displayName.localeCompare(right.displayName),
      ),
    }));
}

function dedupeMatches(matches: BucketModuleMatch[]) {
  const seen = new Set<string>();
  return matches.filter((match) => {
    const key = `${match.bucketId}:${match.moduleName}:${match.manifestPath}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

type TreeEntry = {
  children?: Map<string, TreeEntry>;
};

function buildFileTree(paths: string[]) {
  const root = new Map<string, TreeEntry>();

  for (const path of paths) {
    const segments = path.split("/").filter(Boolean);
    let current = root;

    segments.forEach((segment, index) => {
      const isLeaf = index === segments.length - 1;
      const existing = current.get(segment);

      if (!existing) {
        current.set(segment, isLeaf ? {} : { children: new Map<string, TreeEntry>() });
      }

      if (!isLeaf) {
        const next =
          current.get(segment)?.children ?? new Map<string, TreeEntry>();
        const entry = current.get(segment);
        if (entry) {
          entry.children = next;
        }
        current = next;
      }
    });
  }

  function toNodes(tree: Map<string, TreeEntry>): RepoFileTreeNode[] {
    return [...tree.entries()]
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([name, value]) => {
        const children = value.children ? toNodes(value.children) : undefined;
        return children && children.length > 0 ? { name, children } : { name };
      });
  }

  return toNodes(root);
}

function buildActivitySeries(commits: RepoCommitSummary[]): RepoActivityEntry[] {
  const counts = new Map<string, number>();

  for (const commit of commits) {
    const isoDate = commit.date.slice(0, 10);
    counts.set(isoDate, (counts.get(isoDate) ?? 0) + 1);
  }

  const end = new Date();
  end.setHours(0, 0, 0, 0);

  return Array.from({ length: 91 }, (_, index) => {
    const date = new Date(end);
    date.setDate(end.getDate() - (90 - index));
    const key = date.toISOString().slice(0, 10);

    return {
      date: key,
      count: counts.get(key) ?? 0,
    };
  });
}

function buildCommitRefs(index: number, branch: string): string[] | undefined {
  if (index === 0) {
    return [branch, `origin/${branch}`];
  }

  if (index === 1) {
    return ["scan-window"];
  }

  return undefined;
}

function toRepoCommitSummary(
  commit: GitHubCommitResponse[number],
  index: number,
  branch: string,
): RepoCommitSummary {
  return {
    hash: commit.sha,
    message: commit.commit.message.split("\n")[0] ?? commit.sha.slice(0, 7),
    author: {
      name: commit.commit.author?.name ?? "Unknown author",
      avatarUrl: commit.author?.avatar_url,
    },
    date: commit.commit.author?.date ?? new Date().toISOString(),
    parents: commit.parents.map((parent) => parent.sha.slice(0, 7)),
    refs: buildCommitRefs(index, branch),
  };
}

function toRepoSummary(repo: GitHubRepoResponse): RepoSummary {
  return {
    id: repo.id,
    name: repo.name,
    fullName: repo.full_name,
    htmlUrl: repo.html_url,
    description: repo.description,
    stargazersCount: repo.stargazers_count,
    forksCount: repo.forks_count,
    language: repo.language,
    topics: repo.topics ?? [],
    archived: repo.archived,
    fork: repo.fork,
    updatedAt: repo.updated_at,
    license: repo.license
      ? {
          key: repo.license.key,
          name: repo.license.name,
          spdxId: repo.license.spdx_id,
        }
      : null,
    owner: {
      login: repo.owner.login,
      avatarUrl: repo.owner.avatar_url,
      htmlUrl: repo.owner.html_url,
    },
  };
}

export async function scanRepository(options: {
  token?: string;
  repoFullName: string;
  authMode: AuthMode;
  defaultBranch?: string;
}): Promise<RepoScanResult> {
  const token = getGitHubToken(options.token, options.authMode) ?? "";

  const [repoOwner, repoName] = options.repoFullName.split("/");
  if (!repoOwner || !repoName) {
    throw new Error("Repository must be in owner/name format.");
  }

  const repoMeta = await fetchGitHubJson<GitHubRepoResponse>(
    `/repos/${options.repoFullName}`,
    { token },
  );

  const defaultBranch = options.defaultBranch ?? repoMeta.default_branch;
  const treeResponse = await fetchRepositoryTree(
    token,
    options.repoFullName,
    defaultBranch,
  );
  const manifestPaths = (treeResponse.tree ?? [])
    .filter((entry) => entry.type === "blob" && isSupportedManifest(entry.path))
    .map((entry) => entry.path)
    .slice(0, 24);

  const manifests = (
    await Promise.all(
      manifestPaths.map(async (manifestPath) => {
        const contentResponse = await fetchRepositoryContent(
          token,
          options.repoFullName,
          manifestPath,
        );
        const source = decodeBase64Content(contentResponse.content);
        const modules = parseModulesByManifest(manifestPath, source);
        return buildManifestScan(manifestPath, modules);
      }),
    )
  ).filter((manifest) => manifest.modules.length > 0);

  const candidates: ModuleCandidate[] = manifests.flatMap((manifest) =>
    manifest.modules.map((moduleName) => ({
      moduleName,
      languageKey: manifest.languageKey,
      manifestPath: manifest.manifestPath,
    })),
  );

  const matches = candidates
    .map((candidate) => toModuleMatch(candidate))
    .filter((entry): entry is BucketModuleMatch => entry !== null);

  const matchedNames = new Set(matches.map((match) => match.moduleName));
  const unmatchedModules = candidates
    .map((candidate) => candidate.moduleName)
    .filter((moduleName) => !matchedNames.has(moduleName))
    .filter((moduleName, index, all) => all.indexOf(moduleName) === index)
    .sort((a, b) => a.localeCompare(b));

  const detectedLanguages = [...new Set(manifests.map((manifest) => manifest.languageKey))]
    .map((key) => getLanguageProfile(key))
    .sort((left, right) => left.rank - right.rank);

  const commitsResponse = await fetchRepositoryCommits(
    token,
    options.repoFullName,
    defaultBranch,
  );
  const commits = commitsResponse.map((commit, index) =>
    toRepoCommitSummary(commit, index, defaultBranch),
  );
  const manifestTree = buildFileTree(manifests.map((manifest) => manifest.manifestPath));
  const highlightedPaths = manifests.slice(0, 8).map((manifest) => manifest.manifestPath);
  const expandedPaths = manifestTree
    .flatMap((node) => collectExpandablePaths(node))
    .slice(0, 8);

  return {
    repoFullName: repoMeta.full_name,
    defaultBranch,
    authMode: options.authMode,
    scannedAt: new Date().toISOString(),
    repo: toRepoSummary(repoMeta),
    activity: buildActivitySeries(commits),
    commits,
    manifestTree,
    highlightedPaths,
    expandedPaths,
    detectedLanguages,
    manifests,
    bucketGroups: bucketizeMatches(matches),
    unmatchedModules,
    summary: {
      manifestsScanned: manifests.length,
      moduleCount: candidates.length,
      mappedModules: matches.length,
    },
  };
}

function collectExpandablePaths(
  node: RepoFileTreeNode,
  parentPath = "",
): string[] {
  const path = parentPath ? `${parentPath}/${node.name}` : node.name;
  if (!node.children?.length) {
    return [];
  }

  return [
    path,
    ...node.children.flatMap((child) => collectExpandablePaths(child, path)),
  ];
}
