import * as simpleIcons from "simple-icons";
import {
  getBucketById,
  type BucketId,
  type BucketLayer,
  type ModuleIcon,
} from "./shared";

type SimpleIconLike = {
  title: string;
  slug: string;
  hex: string;
  path: string;
};

export interface CatalogMatch {
  bucketId: BucketId;
  displayName: string;
  description: string;
  layer: BucketLayer;
  matchKind: "catalog" | "heuristic";
  icon?: ModuleIcon;
}

type CatalogEntry = {
  bucketId: BucketId;
  displayName: string;
  description: string;
  aliases?: string[];
};

function normalizeToken(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/^@/, "")
    .replace(/[._/:-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function getModuleKeyVariants(moduleName: string) {
  const withoutTypes = moduleName.replace(/^@types\//, "");
  const parts = withoutTypes.split("/").filter(Boolean);
  const variants = new Set<string>([
    normalizeToken(moduleName),
    normalizeToken(withoutTypes),
  ]);

  if (parts.length > 1) {
    variants.add(normalizeToken(parts[parts.length - 1]));
    variants.add(normalizeToken(parts.join(" ")));
  }

  return [...variants].filter(Boolean);
}

const SIMPLE_ICON_INDEX = new Map<string, ModuleIcon>();

for (const candidate of Object.values(simpleIcons)) {
  if (
    typeof candidate !== "object" ||
    candidate == null ||
    !("slug" in candidate) ||
    !("path" in candidate)
  ) {
    continue;
  }

  const icon = candidate as SimpleIconLike;
  const moduleIcon: ModuleIcon = {
    title: icon.title,
    hex: icon.hex,
    path: icon.path,
  };

  for (const key of new Set([
    normalizeToken(icon.slug),
    normalizeToken(icon.title),
  ])) {
    if (!SIMPLE_ICON_INDEX.has(key)) {
      SIMPLE_ICON_INDEX.set(key, moduleIcon);
    }
  }
}

function findIcon(moduleName: string) {
  for (const variant of getModuleKeyVariants(moduleName)) {
    const icon = SIMPLE_ICON_INDEX.get(variant);
    if (icon) {
      return icon;
    }
  }

  return undefined;
}

const CATALOG: CatalogEntry[] = [
  {
    bucketId: "identity-ui",
    displayName: "NextAuth.js",
    description: "Authentication flows for Next.js apps.",
    aliases: ["next-auth", "authjs", "@auth/core", "@auth/prisma-adapter"],
  },
  {
    bucketId: "identity-ui",
    displayName: "Clerk",
    description: "Hosted sign-in, sign-up, and user profile UI.",
    aliases: ["clerk", "@clerk/nextjs", "@clerk/clerk-js"],
  },
  {
    bucketId: "identity-ui",
    displayName: "Auth0",
    description: "Identity provider for login and profile management.",
    aliases: ["auth0", "@auth0/nextjs-auth0", "@auth0/auth0-react"],
  },
  {
    bucketId: "identity-ui",
    displayName: "Firebase Auth",
    description: "Client and backend authentication primitives.",
    aliases: ["firebase", "firebase-auth", "@firebase/auth", "supabase-auth-js"],
  },
  {
    bucketId: "state-management",
    displayName: "Redux Toolkit",
    description: "Predictable client state orchestration.",
    aliases: ["@reduxjs/toolkit", "redux", "react-redux"],
  },
  {
    bucketId: "state-management",
    displayName: "Zustand",
    description: "Lightweight client-side source-of-truth store.",
    aliases: ["zustand"],
  },
  {
    bucketId: "state-management",
    displayName: "MobX",
    description: "Observable state synchronization.",
    aliases: ["mobx", "mobx-state-tree"],
  },
  {
    bucketId: "state-management",
    displayName: "TanStack Query",
    description: "Server state synchronization and caching.",
    aliases: [
      "@tanstack/react-query",
      "@tanstack/query-core",
      "react-query",
      "tanstack query",
      "swr",
      "apollo-client",
      "@apollo/client",
    ],
  },
  {
    bucketId: "core-rendering",
    displayName: "React",
    description: "Component-driven client rendering engine.",
    aliases: ["react", "react-dom", "preact", "inferno"],
  },
  {
    bucketId: "core-rendering",
    displayName: "Next.js",
    description: "Hybrid SSR, CSR, and static rendering runtime.",
    aliases: ["next", "nextjs"],
  },
  {
    bucketId: "core-rendering",
    displayName: "Vue",
    description: "Reactive front-end rendering runtime.",
    aliases: ["vue", "nuxt", "nuxt3", "vue-router"],
  },
  {
    bucketId: "core-rendering",
    displayName: "Svelte",
    description: "Compiled UI rendering and static generation.",
    aliases: ["svelte", "@sveltejs/kit", "astro", "gatsby", "remix"],
  },
  {
    bucketId: "interaction-design",
    displayName: "React Hook Form",
    description: "Form state and validation flows.",
    aliases: ["react-hook-form", "formik", "final-form"],
  },
  {
    bucketId: "interaction-design",
    displayName: "Zod",
    description: "Schema validation for forms and interaction rules.",
    aliases: ["zod", "yup", "valibot"],
  },
  {
    bucketId: "interaction-design",
    displayName: "Framer Motion",
    description: "User feedback, animation, and motion cues.",
    aliases: ["framer-motion", "motion", "react-spring"],
  },
  {
    bucketId: "interaction-design",
    displayName: "Router",
    description: "Navigation and in-app transitions.",
    aliases: [
      "react-router",
      "react-router-dom",
      "@tanstack/react-router",
      "expo-router",
    ],
  },
  {
    bucketId: "asset-delivery",
    displayName: "Vite",
    description: "Fast bundling and dev asset pipeline.",
    aliases: ["vite", "vitest"],
  },
  {
    bucketId: "asset-delivery",
    displayName: "Webpack",
    description: "Module bundling and asset compilation.",
    aliases: ["webpack", "webpack-cli", "webpack-dev-server"],
  },
  {
    bucketId: "asset-delivery",
    displayName: "esbuild",
    description: "Transpilation and fast build optimization.",
    aliases: ["esbuild", "swc", "@swc/core", "rollup", "parcel", "babel"],
  },
  {
    bucketId: "asset-delivery",
    displayName: "Tailwind CSS",
    description: "Build-time CSS generation and compression.",
    aliases: ["tailwindcss", "postcss", "autoprefixer", "sass", "less"],
  },
  {
    bucketId: "global-interface",
    displayName: "i18next",
    description: "Localization and multilingual UI delivery.",
    aliases: ["i18next", "react-i18next", "next-intl", "react-intl", "formatjs"],
  },
  {
    bucketId: "global-interface",
    displayName: "React Aria",
    description: "Accessible interface primitives.",
    aliases: ["react-aria", "@react-aria/components", "axe-core", "aria-kit"],
  },
  {
    bucketId: "edge-support",
    displayName: "Intercom",
    description: "Customer assistance widgets embedded in the app.",
    aliases: ["intercom", "@intercom/messenger-js-sdk", "crisp-sdk-web", "drift"],
  },
  {
    bucketId: "edge-support",
    displayName: "Zendesk",
    description: "Live support and embedded service surfaces.",
    aliases: ["zendesk", "@zendesk/widget-web-sdk", "help-scout", "livechat"],
  },
  {
    bucketId: "experimentation",
    displayName: "LaunchDarkly",
    description: "Feature flags and experiment rollout control.",
    aliases: ["launchdarkly", "launchdarkly-react-client-sdk", "unleash-proxy-client"],
  },
  {
    bucketId: "experimentation",
    displayName: "Statsig",
    description: "A/B testing and dynamic feature evaluation.",
    aliases: ["statsig", "optimizely", "posthog", "growthbook"],
  },
  {
    bucketId: "user-observability",
    displayName: "Vercel Analytics",
    description: "Client-side analytics and usage measurement.",
    aliases: ["@vercel/analytics", "google-analytics", "gtag", "mixpanel", "amplitude", "segment"],
  },
  {
    bucketId: "user-observability",
    displayName: "PostHog",
    description: "Product analytics and session-level behavior tracking.",
    aliases: ["posthog-js", "posthog-node", "fullstory", "logrocket"],
  },
  {
    bucketId: "error-boundaries",
    displayName: "Sentry",
    description: "Frontend crash reporting and fault capture.",
    aliases: ["sentry", "@sentry/nextjs", "@sentry/react", "@sentry/node"],
  },
  {
    bucketId: "error-boundaries",
    displayName: "Rollbar",
    description: "Client runtime error monitoring.",
    aliases: ["rollbar", "bugsnag", "honeybadger"],
  },
  {
    bucketId: "persistence-strategy",
    displayName: "localForage",
    description: "Client persistence and offline synchronization.",
    aliases: ["localforage", "dexie", "idb", "pouchdb"],
  },
  {
    bucketId: "persistence-strategy",
    displayName: "js-cookie",
    description: "Cookie orchestration and browser state persistence.",
    aliases: ["js-cookie", "redux-persist"],
  },
  {
    bucketId: "visual-systems",
    displayName: "Radix UI",
    description: "Design system primitives and composable UI controls.",
    aliases: ["radix-ui", "@radix-ui/react-dialog", "@radix-ui/react-popover"],
  },
  {
    bucketId: "visual-systems",
    displayName: "shadcn/ui",
    description: "Component library and theming layer.",
    aliases: ["shadcn", "lucide-react", "class-variance-authority", "tailwind-merge"],
  },
  {
    bucketId: "visual-systems",
    displayName: "MUI",
    description: "Themeable component system.",
    aliases: ["@mui/material", "material-ui", "chakra-ui", "ant-design", "styled-components", "emotion"],
  },
  {
    bucketId: "access-control",
    displayName: "Casbin",
    description: "Authorization and policy enforcement.",
    aliases: ["casbin", "pycasbin", "spring-security", "permitio"],
  },
  {
    bucketId: "access-control",
    displayName: "Passport",
    description: "Authentication and permission middleware.",
    aliases: ["passport", "passport-jwt", "passport-local", "keycloak"],
  },
  {
    bucketId: "system-telemetry",
    displayName: "OpenTelemetry",
    description: "Tracing, metrics, and distributed observability.",
    aliases: ["opentelemetry", "@opentelemetry/api", "@opentelemetry/sdk-node"],
  },
  {
    bucketId: "system-telemetry",
    displayName: "Prometheus",
    description: "Metrics aggregation and operational visibility.",
    aliases: ["prometheus", "prom-client", "grafana", "datadog", "newrelic"],
  },
  {
    bucketId: "system-telemetry",
    displayName: "Pino",
    description: "Structured backend logging.",
    aliases: ["pino", "winston", "bunyan", "logrus", "zap"],
  },
  {
    bucketId: "data-persistence",
    displayName: "Prisma",
    description: "Typed ORM and schema evolution.",
    aliases: ["prisma", "@prisma/client"],
  },
  {
    bucketId: "data-persistence",
    displayName: "Drizzle ORM",
    description: "SQL-first persistence and migrations.",
    aliases: ["drizzle-orm", "drizzle-kit"],
  },
  {
    bucketId: "data-persistence",
    displayName: "PostgreSQL",
    description: "Primary relational data store.",
    aliases: ["postgres", "pg", "postgresql", "psycopg2", "libpq", "diesel", "sqlx"],
  },
  {
    bucketId: "data-persistence",
    displayName: "MySQL",
    description: "Operational relational storage.",
    aliases: ["mysql", "mysql2", "mariadb"],
  },
  {
    bucketId: "data-persistence",
    displayName: "MongoDB",
    description: "Document persistence layer.",
    aliases: ["mongodb", "mongoose", "pymongo"],
  },
  {
    bucketId: "data-persistence",
    displayName: "Redis",
    description: "Key-value persistence and caching.",
    aliases: ["redis", "ioredis", "lettuce", "redisson"],
  },
  {
    bucketId: "data-persistence",
    displayName: "SQLAlchemy",
    description: "Python persistence and schema mapping.",
    aliases: ["sqlalchemy", "alembic", "django", "hibernate", "typeorm", "sequelize", "gorm", "activerecord"],
  },
  {
    bucketId: "background-processing",
    displayName: "BullMQ",
    description: "Asynchronous job queues and worker execution.",
    aliases: ["bullmq", "bull", "agenda"],
  },
  {
    bucketId: "background-processing",
    displayName: "Celery",
    description: "Python background task orchestration.",
    aliases: ["celery", "rq", "dramatiq", "sidekiq", "resque", "hangfire"],
  },
  {
    bucketId: "background-processing",
    displayName: "Temporal",
    description: "Durable workflow execution.",
    aliases: ["temporal", "@temporalio/client", "@temporalio/worker"],
  },
  {
    bucketId: "background-processing",
    displayName: "RabbitMQ",
    description: "Message brokering for async work.",
    aliases: ["rabbitmq", "amqplib", "kafka", "nats"],
  },
  {
    bucketId: "traffic-control",
    displayName: "NGINX",
    description: "Reverse proxy and request shaping.",
    aliases: ["nginx", "envoy", "haproxy"],
  },
  {
    bucketId: "traffic-control",
    displayName: "Kong",
    description: "Rate limiting and policy enforcement at the edge.",
    aliases: ["kong", "rate-limiter-flexible", "resilience4j"],
  },
  {
    bucketId: "network-edge",
    displayName: "Cloudflare",
    description: "CDN and globally distributed delivery.",
    aliases: ["cloudflare", "workers", "wrangler", "fastly", "akamai"],
  },
  {
    bucketId: "network-edge",
    displayName: "CloudFront",
    description: "Global content caching for static and dynamic assets.",
    aliases: ["cloudfront", "aws-cloudfront", "vercel", "netlify"],
  },
  {
    bucketId: "search-architecture",
    displayName: "Elasticsearch",
    description: "Indexing and query-time retrieval.",
    aliases: ["elasticsearch", "@elastic/elasticsearch", "opensearch", "solr"],
  },
  {
    bucketId: "search-architecture",
    displayName: "Algolia",
    description: "Hosted search indexing and retrieval.",
    aliases: ["algolia", "algoliasearch", "meilisearch", "typesense", "lunr"],
  },
  {
    bucketId: "security-ops",
    displayName: "Vault",
    description: "Secrets management and credential brokering.",
    aliases: ["vault", "hashicorp-vault", "aws-secrets-manager", "doppler"],
  },
  {
    bucketId: "security-ops",
    displayName: "reCAPTCHA",
    description: "Bot protection and fraud mitigation.",
    aliases: ["recaptcha", "grecaptcha", "hcaptcha", "cloudflare-turnstile"],
  },
  {
    bucketId: "security-ops",
    displayName: "Snyk",
    description: "Dependency and application security posture.",
    aliases: ["snyk", "dependabot", "trivy"],
  },
  {
    bucketId: "connectivity-layer",
    displayName: "GraphQL",
    description: "API schema and gateway orchestration.",
    aliases: ["graphql", "apollo-server", "@apollo/server", "graphql-yoga"],
  },
  {
    bucketId: "connectivity-layer",
    displayName: "gRPC",
    description: "Service-to-service connectivity layer.",
    aliases: ["grpc", "@grpc/grpc-js", "connectrpc", "consul", "traefik"],
  },
  {
    bucketId: "connectivity-layer",
    displayName: "tRPC",
    description: "Typed API gateway and service boundary.",
    aliases: ["trpc", "@trpc/server", "@trpc/client", "apollo-gateway"],
  },
  {
    bucketId: "resiliency",
    displayName: "Litestream",
    description: "Replica shipping and database recovery workflows.",
    aliases: ["litestream", "pgbackrest", "restic", "velero"],
  },
  {
    bucketId: "resiliency",
    displayName: "Resilience4j",
    description: "Circuit-breaking and recovery guards.",
    aliases: ["resilience4j", "hystrix", "failsafe"],
  },
  {
    bucketId: "data-sovereignty",
    displayName: "OneTrust",
    description: "Consent, privacy, and retention governance.",
    aliases: ["onetrust", "transcend", "segment-consent-manager"],
  },
  {
    bucketId: "data-sovereignty",
    displayName: "Airbyte",
    description: "Archiving and governed data movement.",
    aliases: ["airbyte", "immudb"],
  },
  {
    bucketId: "analytical-intelligence",
    displayName: "dbt",
    description: "Transform pipelines and analytical modeling.",
    aliases: ["dbt", "dbt-core"],
  },
  {
    bucketId: "analytical-intelligence",
    displayName: "Airflow",
    description: "ETL orchestration and scheduled data workflows.",
    aliases: ["airflow", "prefect", "dagster"],
  },
  {
    bucketId: "analytical-intelligence",
    displayName: "Snowflake",
    description: "Warehouse-scale analytical storage.",
    aliases: ["snowflake", "bigquery", "redshift", "spark", "fivetran", "metabase", "superset"],
  },
];

const EXACT_CATALOG = new Map<string, CatalogEntry>();

for (const entry of CATALOG) {
  for (const alias of entry.aliases ?? [entry.displayName]) {
    EXACT_CATALOG.set(normalizeToken(alias), entry);
  }
}

const HEURISTIC_KEYWORDS: Record<BucketId, string[]> = {
  "identity-ui": ["auth", "login", "signin", "session", "oauth"],
  "state-management": ["store", "state", "query", "cache", "signal"],
  "core-rendering": ["react", "vue", "svelte", "render", "next", "nuxt"],
  "interaction-design": ["form", "router", "motion", "schema", "validate"],
  "asset-delivery": ["build", "bundle", "transpile", "css", "webpack", "vite"],
  "global-interface": ["i18n", "intl", "locale", "aria", "a11y"],
  "edge-support": ["chat", "support", "widget", "messenger"],
  "experimentation": ["feature", "flag", "experiment", "variant"],
  "user-observability": ["analytics", "session", "funnel", "track"],
  "error-boundaries": ["error", "crash", "exception"],
  "persistence-strategy": ["cookie", "storage", "persist", "indexeddb"],
  "visual-systems": ["ui", "theme", "component", "design", "icon"],
  "access-control": ["rbac", "permission", "policy", "access"],
  "system-telemetry": ["trace", "metric", "monitor", "log"],
  "data-persistence": ["db", "database", "orm", "sql", "mongo", "redis"],
  "background-processing": ["queue", "worker", "job", "task"],
  "traffic-control": ["proxy", "rate", "throttle", "gateway"],
  "network-edge": ["cdn", "edge", "cache", "delivery"],
  "search-architecture": ["search", "index", "retriev"],
  "security-ops": ["secret", "fraud", "captcha", "security"],
  "connectivity-layer": ["api", "rpc", "service", "graphql"],
  resiliency: ["backup", "recover", "retry", "circuit"],
  "data-sovereignty": ["privacy", "consent", "archive", "compliance"],
  "analytical-intelligence": ["etl", "warehouse", "analytics", "pipeline"],
};

export function resolveCatalogMatch(moduleName: string): CatalogMatch | null {
  const variants = getModuleKeyVariants(moduleName);

  for (const variant of variants) {
    const exact = EXACT_CATALOG.get(variant);
    if (exact) {
      const bucket = getBucketById(exact.bucketId);
      return {
        bucketId: exact.bucketId,
        displayName: exact.displayName,
        description: exact.description,
        layer: bucket.layer,
        matchKind: "catalog",
        icon: findIcon(moduleName) ?? findIcon(exact.displayName),
      };
    }
  }

  const haystack = variants.join(" ");
  for (const [bucketId, keywords] of Object.entries(HEURISTIC_KEYWORDS) as Array<
    [BucketId, string[]]
  >) {
    if (keywords.some((keyword) => haystack.includes(keyword))) {
      const bucket = getBucketById(bucketId);
      return {
        bucketId,
        displayName: moduleName,
        description: `Heuristic match for ${bucket.title.toLowerCase()}.`,
        layer: bucket.layer,
        matchKind: "heuristic",
        icon: findIcon(moduleName),
      };
    }
  }

  return null;
}

export function getModuleIcon(moduleName: string) {
  return findIcon(moduleName);
}
