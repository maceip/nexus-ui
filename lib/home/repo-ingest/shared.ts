export type IngestMode = "single" | "twin";
export type AuthMode = "pat" | "backup";
export type BucketLayer = "frontend" | "backend";

export type BucketId =
  | "identity-ui"
  | "state-management"
  | "core-rendering"
  | "interaction-design"
  | "asset-delivery"
  | "global-interface"
  | "edge-support"
  | "experimentation"
  | "user-observability"
  | "error-boundaries"
  | "persistence-strategy"
  | "visual-systems"
  | "access-control"
  | "system-telemetry"
  | "data-persistence"
  | "background-processing"
  | "traffic-control"
  | "network-edge"
  | "search-architecture"
  | "security-ops"
  | "connectivity-layer"
  | "resiliency"
  | "data-sovereignty"
  | "analytical-intelligence";

export interface ArchitectureBucket {
  id: BucketId;
  layer: BucketLayer;
  title: string;
  description: string;
}

export interface LanguageProfile {
  key:
    | "python"
    | "javascript"
    | "java"
    | "c"
    | "cpp"
    | "typescript"
    | "csharp"
    | "sql"
    | "go"
    | "rust"
    | "php"
    | "swift"
    | "kotlin"
    | "ruby"
    | "r";
  title: string;
  rank: number;
  primaryDomain: string;
  status: string;
}

export interface RepoSuggestion {
  id: number;
  fullName: string;
  owner: string;
  name: string;
  description: string | null;
  pushedAt: string;
  private: boolean;
  defaultBranch: string;
}

export interface ManifestScan {
  languageKey: LanguageProfile["key"];
  manifestPath: string;
  modules: string[];
}

export interface ModuleIcon {
  title: string;
  hex: string;
  path: string;
}

export interface BucketModuleMatch {
  bucketId: BucketId;
  moduleName: string;
  displayName: string;
  description: string;
  languageKey: LanguageProfile["key"];
  manifestPath: string;
  layer: BucketLayer;
  matchKind: "catalog" | "heuristic";
  icon?: ModuleIcon;
}

export interface BucketGroup {
  bucket: ArchitectureBucket;
  modules: BucketModuleMatch[];
}

export interface RepoScanSummary {
  manifestsScanned: number;
  moduleCount: number;
  mappedModules: number;
}

export interface RepoScanResult {
  repoFullName: string;
  defaultBranch: string;
  authMode: AuthMode;
  scannedAt: string;
  detectedLanguages: LanguageProfile[];
  manifests: ManifestScan[];
  bucketGroups: BucketGroup[];
  unmatchedModules: string[];
  summary: RepoScanSummary;
}

export const ARCHITECTURE_BUCKETS: ArchitectureBucket[] = [
  {
    id: "identity-ui",
    layer: "frontend",
    title: "Identity UI",
    description: "Login, sign-up, and profile management flows.",
  },
  {
    id: "state-management",
    layer: "frontend",
    title: "State Management",
    description: 'Real-time synchronization of the "source of truth."',
  },
  {
    id: "core-rendering",
    layer: "frontend",
    title: "Core Rendering",
    description: "The engine for painting pixels (SSR, CSR, or Static).",
  },
  {
    id: "interaction-design",
    layer: "frontend",
    title: "Interaction Design",
    description: "Form logic, navigation, and user feedback loops.",
  },
  {
    id: "asset-delivery",
    layer: "frontend",
    title: "Asset Delivery",
    description: "Optimized bundling, transpilation, and compression.",
  },
  {
    id: "global-interface",
    layer: "frontend",
    title: "Global Interface",
    description: "Localization, accessibility, and regional adaptation.",
  },
  {
    id: "edge-support",
    layer: "frontend",
    title: "Edge Support",
    description: "In-page assistance and real-time support widgets.",
  },
  {
    id: "experimentation",
    layer: "frontend",
    title: "Experimentation",
    description: "A/B testing and dynamic feature toggling.",
  },
  {
    id: "user-observability",
    layer: "frontend",
    title: "User Observability",
    description: "Client-side analytics and session tracking.",
  },
  {
    id: "error-boundaries",
    layer: "frontend",
    title: "Error Boundaries",
    description: "Frontend fault tolerance and crash reporting.",
  },
  {
    id: "persistence-strategy",
    layer: "frontend",
    title: "Persistence Strategy",
    description: "Cookie management and local storage syncing.",
  },
  {
    id: "visual-systems",
    layer: "frontend",
    title: "Visual Systems",
    description: "Theming, typography, and component libraries.",
  },
  {
    id: "access-control",
    layer: "backend",
    title: "Access Control",
    description: "Authorization, RBAC, and permission logic.",
  },
  {
    id: "system-telemetry",
    layer: "backend",
    title: "System Telemetry",
    description: "Distributed logging, tracing, and monitoring.",
  },
  {
    id: "data-persistence",
    layer: "backend",
    title: "Data Persistence",
    description: "Primary database management and schema evolution.",
  },
  {
    id: "background-processing",
    layer: "backend",
    title: "Background Processing",
    description: "Asynchronous workers and task queues.",
  },
  {
    id: "traffic-control",
    layer: "backend",
    title: "Traffic Control",
    description: "Load balancing, rate limiting, and throttling.",
  },
  {
    id: "network-edge",
    layer: "backend",
    title: "Network Edge",
    description: "CDN integration and global content caching.",
  },
  {
    id: "search-architecture",
    layer: "backend",
    title: "Search Architecture",
    description: "Full-text indexing and retrieval engines.",
  },
  {
    id: "security-ops",
    layer: "backend",
    title: "Security Ops",
    description: "Secrets management, WAF, and fraud detection.",
  },
  {
    id: "connectivity-layer",
    layer: "backend",
    title: "Connectivity Layer",
    description: "API gateways and service discovery.",
  },
  {
    id: "resiliency",
    layer: "backend",
    title: "Resiliency",
    description: "Automated backups and disaster recovery protocols.",
  },
  {
    id: "data-sovereignty",
    layer: "backend",
    title: "Data Sovereignty",
    description: "Compliance, privacy, and archiving tools.",
  },
  {
    id: "analytical-intelligence",
    layer: "backend",
    title: "Analytical Intelligence",
    description: "Data warehousing and ETL pipelines.",
  },
];

export const LANGUAGE_PROFILES: LanguageProfile[] = [
  {
    key: "python",
    title: "Python",
    rank: 1,
    primaryDomain: "AI, Data Science, Scripting",
    status: "Undisputed #1; dominant in AI/ML.",
  },
  {
    key: "javascript",
    title: "JavaScript",
    rank: 2,
    primaryDomain: "Web Front-end, Node.js",
    status: "Most used for web interactivity.",
  },
  {
    key: "java",
    title: "Java",
    rank: 3,
    primaryDomain: "Enterprise, Android",
    status: "Legacy giant; still essential for backend.",
  },
  {
    key: "c",
    title: "C",
    rank: 4,
    primaryDomain: "Embedded, Systems",
    status: "Gaining ground in second place on TIOBE.",
  },
  {
    key: "cpp",
    title: "C++",
    rank: 5,
    primaryDomain: "Game Dev, High Performance",
    status: "Heavy use in performance-critical apps.",
  },
  {
    key: "typescript",
    title: "TypeScript",
    rank: 6,
    primaryDomain: "Scalable Web Dev",
    status: "Now outperforming JavaScript on GitHub.",
  },
  {
    key: "csharp",
    title: "C#",
    rank: 7,
    primaryDomain: "Enterprise, Unity Gaming",
    status: "Strong year-over-year growth in .NET.",
  },
  {
    key: "sql",
    title: "SQL",
    rank: 8,
    primaryDomain: "Database Management",
    status: "Fundamental; indispensable for data roles.",
  },
  {
    key: "go",
    title: "Go",
    rank: 9,
    primaryDomain: "Cloud-Native, Infrastructure",
    status: "The standard for microservices and DevOps.",
  },
  {
    key: "rust",
    title: "Rust",
    rank: 10,
    primaryDomain: "Systems, Security",
    status: 'Ranked as the "Most Admired" for safety.',
  },
  {
    key: "php",
    title: "PHP",
    rank: 11,
    primaryDomain: "Web (Legacy), WordPress",
    status: "Stable usage despite a slow long-term dip.",
  },
  {
    key: "swift",
    title: "Swift",
    rank: 12,
    primaryDomain: "iOS/macOS Development",
    status: "The primary choice for Apple ecosystems.",
  },
  {
    key: "kotlin",
    title: "Kotlin",
    rank: 13,
    primaryDomain: "Android, Multiplatform",
    status: "Modern successor to Java for mobile.",
  },
  {
    key: "ruby",
    title: "Ruby",
    rank: 14,
    primaryDomain: "Rapid Prototyping, Web",
    status: "Favored by startups (Rails) for speed.",
  },
  {
    key: "r",
    title: "R",
    rank: 15,
    primaryDomain: "Statistical Computing",
    status: "Holding steady in academia and analytics.",
  },
];

export function getBucketById(bucketId: BucketId) {
  const bucket = ARCHITECTURE_BUCKETS.find((entry) => entry.id === bucketId);
  if (!bucket) {
    throw new Error(`Unknown bucket: ${bucketId}`);
  }

  return bucket;
}

export function getLanguageProfile(key: LanguageProfile["key"]) {
  const language = LANGUAGE_PROFILES.find((entry) => entry.key === key);
  if (!language) {
    throw new Error(`Unknown language profile: ${key}`);
  }

  return language;
}

export function isBucketLayer(value: string): value is BucketLayer {
  return value === "frontend" || value === "backend";
}
