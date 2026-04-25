#!/usr/bin/env node

import { copyFileSync, existsSync, mkdirSync, rmSync, writeFileSync } from "fs";
import { join } from "path";

const root = process.cwd();
const outDir = join(root, "out");
const publicDir = join(root, "public");
const basePath = (process.env.NEXT_PUBLIC_BASE_PATH || "").replace(/\/$/, "");
const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "https://maceip.github.io/nexus-ui";

rmSync(outDir, { recursive: true, force: true });
mkdirSync(join(outDir, "assets"), { recursive: true });
mkdirSync(join(outDir, "showcase"), { recursive: true });

const stylesPath = `${basePath}/assets/site.css`;
const scriptPath = `${basePath}/assets/app.js`;

writeFileSync(join(outDir, "assets", "site.css"), buildStyles());
writeFileSync(join(outDir, "assets", "app.js"), buildScript());

const html = buildHtml({ stylesPath, scriptPath, siteUrl });
writeFileSync(join(outDir, "index.html"), html);
writeFileSync(join(outDir, "showcase", "index.html"), html);
writeFileSync(join(outDir, "404.html"), html);
writeFileSync(join(outDir, ".nojekyll"), "");

for (const asset of ["favicon.ico", "site.webmanifest"]) {
  const source = join(publicDir, asset);
  if (existsSync(source)) {
    copyFileSync(source, join(outDir, asset));
  }
}

console.log("✓ Materialized fully static interactive Pages artifact in out/");

function buildHtml({ stylesPath, scriptPath, siteUrl }) {
  return `<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>Nexus UI Showcase</title>
    <meta
      name="description"
      content="Interactive component showcase for RepoCard, CommitGraph, ActivityGraph, FileTree, and contextual inputs."
    />
    <link rel="icon" href="${basePath}/favicon.ico" />
    <link rel="stylesheet" href="${stylesPath}" />
  </head>
  <body>
    <main class="page-shell">
      <div class="page-frame">
        <header class="hero">
          <p class="eyebrow">NEXUS UI GALLERY</p>
          <h1>Interactive component showcase</h1>
          <p class="hero-copy">
            Static GitHub Pages deployment for the repository insights components and contextual
            inputs. Everything on this page is clickable without Next.js hydration.
          </p>
          <div class="hero-actions">
            <a class="hero-button hero-button-primary" href="${siteUrl}/showcase/">Open showcase</a>
            <a class="hero-button hero-button-secondary" href="https://github.com/maceip/nexus-ui" target="_blank" rel="noreferrer">View repository</a>
          </div>
        </header>

        <section class="showcase-section">
          <div class="section-heading">
            <h2>Contextual inputs</h2>
            <p>GitHub and Hugging Face specific inputs with built-in validation.</p>
          </div>
          <div class="context-grid">
            <label class="context-card context-card-github" data-context-card="github">
              <div class="context-icon github-icon" aria-hidden="true">
                <svg viewBox="0 0 16 16" fill="currentColor"><path d="M8 0C3.58 0 0 3.67 0 8.2c0 3.63 2.29 6.71 5.47 7.8.4.08.55-.18.55-.39 0-.19-.01-.82-.01-1.49-2.22.49-2.69-.97-2.69-.97-.36-.95-.89-1.2-.89-1.2-.73-.51.05-.5.05-.5.81.06 1.24.85 1.24.85.72 1.27 1.88.9 2.34.69.07-.54.28-.91.5-1.12-1.77-.21-3.64-.91-3.64-4.07 0-.9.31-1.63.82-2.21-.08-.21-.36-1.06.08-2.22 0 0 .67-.22 2.2.84A7.38 7.38 0 0 1 8 4.78c.68 0 1.37.09 2.01.27 1.53-1.06 2.2-.84 2.2-.84.44 1.16.16 2.01.08 2.22.51.58.82 1.31.82 2.21 0 3.17-1.88 3.85-3.67 4.06.29.26.54.77.54 1.56 0 1.13-.01 2.03-.01 2.31 0 .21.14.48.55.39A8.2 8.2 0 0 0 16 8.2C16 3.67 12.42 0 8 0Z"></path></svg>
              </div>
              <span class="context-label">GitHub repo</span>
              <input id="github-input" type="text" value="github.com/shadcn-ui/ui" />
              <p class="context-hint" id="github-hint">Needs a GitHub repo like github.com/google/repo</p>
            </label>

            <label class="context-card context-card-hf" data-context-card="huggingface">
              <div class="context-icon hf-icon" aria-hidden="true">
                <svg viewBox="0 0 16 16" fill="none"><circle cx="8" cy="8" r="7" fill="#FACC15"/><path d="M5.15 6.35a.85.85 0 1 0 0-1.7.85.85 0 0 0 0 1.7ZM10.85 6.35a.85.85 0 1 0 0-1.7.85.85 0 0 0 0 1.7Z" fill="#7C4A03"/><path d="M4.6 8.7c.72 1.3 1.92 1.95 3.4 1.95 1.48 0 2.68-.65 3.4-1.95" stroke="#7C4A03" stroke-width="1.2" stroke-linecap="round"/><path d="M3.85 7.4c.1-.62.4-1.04.88-1.26m7.42 1.26c-.1-.62-.4-1.04-.88-1.26" stroke="#7C4A03" stroke-width="1.1" stroke-linecap="round"/></svg>
              </div>
              <span class="context-label">Hugging Face repo</span>
              <input id="hf-input" type="text" value="huggingface.co/google/gemma-3-1b" />
              <p class="context-hint" id="hf-hint">Needs a Hugging Face repo like huggingface.co/google/gemma-3-1b</p>
            </label>
          </div>

          <div class="context-normalized">
            <div>
              <span class="normalized-label">GitHub normalized</span>
              <span id="github-normalized">github.com/shadcn-ui/ui</span>
            </div>
            <div>
              <span class="normalized-label">Hugging Face normalized</span>
              <span id="hf-normalized">huggingface.co/google/gemma-3-1b</span>
            </div>
          </div>
        </section>

        <section class="showcase-section">
          <div class="section-heading">
            <h2>Repo cards</h2>
            <p>Dark GitHub-style previews with compact metadata rows.</p>
          </div>
          <div class="repo-grid">
            ${buildRepoCards()}
          </div>
        </section>

        <section class="showcase-section">
          <div class="section-heading">
            <h2>Commit graph</h2>
            <p>Topology-first commit list with click-to-open details.</p>
          </div>
          <div class="commit-shell">
            ${buildCommitGraph()}
          </div>
        </section>

        <section class="showcase-section">
          <div class="section-heading">
            <h2>Activity graph</h2>
            <p>Static GitHub-like heatmap plus a side-scrolling loading wave.</p>
          </div>
          <div class="activity-stack">
            ${buildActivityGraph(false)}
            ${buildActivityGraph(true)}
          </div>
        </section>

        <section class="showcase-section">
          <div class="section-heading">
            <h2>File tree</h2>
            <p>Collapsible file tree with clickable folders.</p>
          </div>
          <div class="file-tree-shell">
            ${buildFileTree()}
          </div>
        </section>
      </div>

      <div class="popover-backdrop" id="commit-popover-backdrop" hidden>
        <div class="commit-popover" id="commit-popover" role="dialog" aria-modal="true">
          <button class="popover-close" id="commit-popover-close" type="button">×</button>
          <div id="commit-popover-content"></div>
        </div>
      </div>
    </main>
    <script src="${scriptPath}"></script>
  </body>
</html>`;
}

function buildRepoCards() {
  const cards = [
    {
      fullName: "shadcn-ui/ui",
      href: "https://github.com/shadcn-ui/ui",
      description:
        "A set of beautifully-designed, accessible components and a code distribution platform. Works with your favorite frameworks. Open Source.",
      topics: ["base-ui", "components", "laravel", "nextjs", "+7"],
      language: "TypeScript",
      color: "#3178C6",
      stars: "112.9k",
      forks: "8.6k",
      license: "MIT",
      updated: "today",
    },
    {
      fullName: "vercel/next.js",
      href: "https://github.com/vercel/next.js",
      description: "The React Framework",
      topics: ["blog", "browser", "compiler", "components", "+10"],
      language: "JavaScript",
      color: "#F7DF1E",
      stars: "139.1k",
      forks: "31.0k",
      license: "MIT",
      updated: "today",
    },
  ];

  return cards
    .map(
      (card) => `<a class="repo-card" href="${card.href}" target="_blank" rel="noreferrer">
        <div class="repo-head">
          <div class="repo-title-row">
            <span class="repo-icon">◔</span>
            <span class="repo-title">${card.fullName}</span>
          </div>
        </div>
        <p class="repo-description">${card.description}</p>
        <div class="repo-topics">${card.topics
          .map((topic) => `<span class="topic-pill">${topic}</span>`)
          .join("")}</div>
        <div class="repo-stats">
          <span class="stat"><span class="lang-dot" style="background:${card.color}"></span>${card.language}</span>
          <span class="stat">★ ${card.stars}</span>
          <span class="stat">⑂ ${card.forks}</span>
          <span class="stat">${card.license}</span>
          <span class="stat stat-right">◷ ${card.updated}</span>
        </div>
      </a>`,
    )
    .join("");
}

function buildCommitGraph() {
  const commits = [
    { hash: "a1b2c3d", message: "feat(auth): add OAuth2 support", author: "Sarah Chen", initials: "SC", time: "2 hours ago", refs: ["main", "HEAD"], tag: "v2.1.0", lane: 0 },
    { hash: "m1e2r3g", message: "Merge branch 'feat/dashboard' into main", author: "Sarah Chen", initials: "SC", time: "6 hours ago", refs: [], lane: 0 },
    { hash: "d4a5s6h", message: "feat: add analytics chart component", author: "Jordan Lee", initials: "JL", time: "8 hours ago", refs: ["feat/dashboard"], lane: 1 },
    { hash: "f6e5d4c", message: "fix(api): handle rate limit headers", author: "Alex Rivera", initials: "AR", time: "18 hours ago", refs: [], lane: 0 },
    { hash: "w1i2p3", message: "wip: dashboard layout skeleton", author: "Jordan Lee", initials: "JL", time: "2 days ago", refs: [], lane: 1 },
    { hash: "4d5e6f1", message: "chore(deps): upgrade next to 15.5", author: "Sarah Chen", initials: "SC", time: "5 days ago", refs: [], tag: "v2.0.0", lane: 0 },
    { hash: "0a1b2c3", message: "Initial commit", author: "Sarah Chen", initials: "SC", time: "Apr 9", refs: [], lane: 0 },
  ];

  return `<div class="commit-graph">
    <svg class="commit-rails" viewBox="0 0 86 448" aria-hidden="true">
      <path d="M18 18 L18 430" stroke="#3b82f6" stroke-width="4" stroke-linecap="round"/>
      <path d="M18 82 C18 82, 52 82, 52 114 L52 210" stroke="#22c55e" stroke-width="4" fill="none" stroke-linecap="round"/>
      <path d="M18 178 C18 178, 18 242, 18 242" stroke="#3b82f6" stroke-width="4" fill="none" stroke-linecap="round"/>
      ${commits
        .map((commit, index) => {
          const y = 18 + index * 64;
          const x = commit.lane === 0 ? 18 : 52;
          const color = commit.lane === 0 ? "#3b82f6" : "#22c55e";
          return `<circle cx="${x}" cy="${y}" r="7" fill="${color}" stroke="#0a0a0a" stroke-width="4" />`;
        })
        .join("")}
    </svg>
    <div class="commit-list">
      ${commits
        .map(
          (commit) => `<button type="button" class="commit-row" data-commit='${JSON.stringify(commit).replace(/'/g, "&apos;")}'>
            <div class="commit-message">
              <span>${commit.message}</span>
              <span class="commit-badges">
                ${commit.refs.map((ref) => `<span class="ref-badge">${ref}</span>`).join("")}
                ${commit.tag ? `<span class="ref-badge ref-tag">${commit.tag}</span>` : ""}
              </span>
            </div>
            <code class="commit-hash">${commit.hash}</code>
            <span class="commit-avatar">${commit.initials}</span>
            <span class="commit-author">${commit.author}</span>
            <span class="commit-time">${commit.time}</span>
          </button>`,
        )
        .join("")}
    </div>
  </div>`;
}

function buildActivityGraph(loading) {
  const weeks = 53;
  const colors = ["#2a2a2a", "#003d2e", "#005f46", "#00a16d", "#00d68f"];
  const cells = Array.from({ length: weeks * 7 }, (_, index) => {
    const week = Math.floor(index / 7);
    const day = index % 7;
    const value = loading
      ? Math.floor(((Math.sin(week * 0.65 - day * 0.18) + 1) / 2) * 5)
      : index % 53 === 0
        ? 4
        : index % 29 === 0
          ? 3
          : index % 17 === 0
            ? 2
            : index % 11 === 0
              ? 1
              : 0;
    return { week, day, value: Math.min(4, value) };
  });
  const months = ["Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec", "Jan", "Feb", "Mar", "Apr"];
  const monthSpans = [4, 4, 5, 4, 5, 4, 4, 5, 4, 4, 4, 5, 1];

  return `<div class="activity-shell">
    <div class="activity-months">${months
      .map((month, index) => `<span style="grid-column: span ${monthSpans[index]}">${month}</span>`)
      .join("")}</div>
    <div class="activity-layout">
      <div class="activity-days"><span>Mon</span><span></span><span>Wed</span><span></span><span>Fri</span><span></span><span></span></div>
      <div class="activity-grid">
        ${Array.from({ length: weeks }, (_, week) => `<div class="activity-week">${cells
          .filter((cell) => cell.week === week)
          .map(
            (cell) => `<span class="activity-cell ${loading ? "is-loading" : ""}" style="background:${colors[cell.value]};animation-delay:${week * 55}ms" title="${loading ? "Loading activity" : `${cell.value} contributions`}"></span>`,
          )
          .join("")}</div>`).join("")}
      </div>
    </div>
    <div class="activity-legend"><span>${loading ? "Loading" : "771 total"}</span><span class="legend-spacer"></span><span>Less</span>${colors
      .map((color) => `<span class="legend-cell" style="background:${color}"></span>`)
      .join("")}<span>More</span></div>
  </div>`;
}

function buildFileTree() {
  return `<div class="file-tree">
    <button type="button" class="tree-item tree-open" data-tree-toggle="src"><span class="tree-caret">▾</span><span class="tree-name">src</span></button>
    <div class="tree-children" data-tree-group="src">
      <button type="button" class="tree-item tree-open" data-tree-toggle="src/app"><span class="tree-caret">▾</span><span class="tree-name">app</span></button>
      <div class="tree-children" data-tree-group="src/app">
        <div class="tree-item tree-leaf"><span class="tree-name">layout.tsx</span></div>
        <div class="tree-item tree-leaf tree-highlight"><span class="tree-name">page.tsx</span></div>
        <button type="button" class="tree-item" data-tree-toggle="src/app/api"><span class="tree-caret">▸</span><span class="tree-name">api</span></button>
        <div class="tree-children" data-tree-group="src/app/api" hidden>
          <div class="tree-item tree-leaf"><span class="tree-name">route.ts</span></div>
        </div>
      </div>
      <button type="button" class="tree-item" data-tree-toggle="src/components"><span class="tree-caret">▸</span><span class="tree-name">components</span></button>
      <div class="tree-children" data-tree-group="src/components" hidden>
        <div class="tree-item tree-leaf"><span class="tree-name">header.tsx</span></div>
        <div class="tree-item tree-leaf"><span class="tree-name">footer.tsx</span></div>
      </div>
      <button type="button" class="tree-item tree-open" data-tree-toggle="src/lib"><span class="tree-caret">▾</span><span class="tree-name">lib</span></button>
      <div class="tree-children" data-tree-group="src/lib">
        <div class="tree-item tree-leaf tree-highlight"><span class="tree-name">utils.ts</span></div>
      </div>
    </div>
    <div class="tree-item tree-leaf"><span class="tree-name">package.json</span></div>
    <div class="tree-item tree-leaf"><span class="tree-name">README.md</span></div>
  </div>`;
}

function buildStyles() {
  return `:root{color-scheme:dark;font-family:Inter,ui-sans-serif,system-ui,-apple-system,sans-serif}*{box-sizing:border-box}[hidden]{display:none!important}body{margin:0;background:#050505;color:#fff}a{text-decoration:none;color:inherit}button,input{font:inherit}button{cursor:pointer}
.page-shell{min-height:100vh;background:#050505;padding:56px 24px}.page-frame{max-width:1120px;margin:0 auto;display:flex;flex-direction:column;gap:56px}.hero{display:flex;flex-direction:column;gap:12px}.eyebrow{margin:0;font-size:12px;letter-spacing:.22em;color:rgba(255,255,255,.45)}.hero h1{margin:0;font-size:42px;line-height:1.05}.hero-copy{max-width:720px;margin:0;color:rgba(255,255,255,.62);line-height:1.6}.hero-actions{display:flex;gap:12px;flex-wrap:wrap}.hero-button{display:inline-flex;align-items:center;justify-content:center;height:40px;padding:0 16px;border-radius:999px;border:1px solid rgba(255,255,255,.12)}.hero-button-primary{background:#fff;color:#111}.hero-button-secondary{background:#111;color:#fff}
.showcase-section{display:flex;flex-direction:column;gap:24px}.section-heading h2{margin:0 0 8px;font-size:24px}.section-heading p{margin:0;color:rgba(255,255,255,.58)}
.context-grid,.repo-grid{display:grid;gap:20px}.context-grid{grid-template-columns:repeat(auto-fit,minmax(280px,1fr))}.repo-grid{grid-template-columns:repeat(auto-fit,minmax(320px,1fr))}
.context-card{position:relative;display:block;overflow:hidden;border-radius:18px;border:1px solid rgba(255,255,255,.08);padding:18px;background:#111;color:#fff}.context-card-github{background-color:rgba(15,23,42,.7);background-image:linear-gradient(135deg,rgba(148,163,184,.14) 0,rgba(148,163,184,.14) 2px,transparent 2px,transparent 14px);background-size:18px 18px}.context-card-hf{background-color:rgba(120,53,15,.16);background-image:radial-gradient(circle,rgba(250,204,21,.32) 1.5px,transparent 1.7px),radial-gradient(circle,rgba(161,98,7,.18) 1.2px,transparent 1.4px);background-size:18px 18px;background-position:0 0,9px 9px}.context-icon{position:absolute;right:14px;top:14px;display:flex;align-items:center;justify-content:center;width:34px;height:34px;border-radius:999px;background:rgba(255,255,255,.14);border:1px solid rgba(255,255,255,.14)}.context-icon svg{width:18px;height:18px}.context-label{display:block;font-size:11px;letter-spacing:.16em;text-transform:uppercase;color:rgba(255,255,255,.58);font-weight:700}.context-card input{width:100%;margin-top:10px;background:transparent;border:0;outline:0;color:#fff;font-size:15px}.context-hint{margin:12px 0 0;color:rgba(255,255,255,.64);font-size:12px}.context-card.is-invalid{border-color:#ef4444}.context-card.is-invalid .context-hint{color:#f87171}.context-normalized{display:grid;grid-template-columns:repeat(auto-fit,minmax(280px,1fr));gap:16px;border-radius:18px;border:1px solid rgba(255,255,255,.08);background:rgba(255,255,255,.03);padding:16px}.normalized-label{display:block;font-size:12px;font-weight:700;color:#fff;margin-bottom:6px}
.repo-card{display:flex;flex-direction:column;gap:20px;border-radius:20px;border:1px solid rgba(255,255,255,.1);background:#09090b;padding:20px;min-height:100%}.repo-head{display:flex;align-items:center;gap:12px}.repo-icon{display:flex;align-items:center;justify-content:center;width:36px;height:36px;border-radius:999px;background:rgba(255,255,255,.06);border:1px solid rgba(255,255,255,.1);font-size:16px}.repo-title{font-size:17px;font-weight:700}.repo-description{margin:0;color:rgba(255,255,255,.85);line-height:1.55}.repo-topics{display:flex;flex-wrap:wrap;gap:8px}.topic-pill{display:inline-flex;align-items:center;padding:6px 12px;border-radius:999px;background:rgba(255,255,255,.07);font-size:11px;font-weight:700}.repo-stats{display:flex;flex-wrap:wrap;gap:18px;color:rgba(255,255,255,.78);font-size:13px}.stat{display:inline-flex;align-items:center;gap:6px}.stat-right{margin-left:auto}.lang-dot{width:12px;height:12px;border-radius:999px;display:inline-block}
.commit-shell{border-radius:22px;border:1px solid rgba(255,255,255,.08);background:#0a0a0a;overflow:hidden}.commit-graph{position:relative;display:flex}.commit-rails{width:86px;flex:0 0 86px}.commit-list{flex:1}.commit-row{display:grid;grid-template-columns:minmax(0,1fr) 110px 42px 140px 110px;align-items:center;gap:16px;width:100%;min-height:64px;padding:0 20px;border:0;border-bottom:1px solid rgba(255,255,255,.06);background:transparent;color:#fff}.commit-row:hover{background:rgba(255,255,255,.02)}.commit-message{display:flex;flex-wrap:wrap;align-items:center;gap:10px;font-size:16px;font-weight:500}.commit-badges{display:flex;flex-wrap:wrap;gap:8px}.ref-badge{display:inline-flex;align-items:center;padding:4px 8px;border-radius:999px;border:1px solid #1b4fb8;background:#0e2448;color:#4e8bff;font-size:11px}.ref-tag{border-color:#1f4fb7;background:#0d2e6e;color:#5f97ff}.commit-hash{font-size:13px;color:rgba(255,255,255,.45)}.commit-avatar{display:flex;align-items:center;justify-content:center;width:26px;height:26px;border-radius:999px;background:rgba(255,255,255,.08);font-size:10px;color:rgba(255,255,255,.8)}.commit-author,.commit-time{font-size:15px;color:rgba(255,255,255,.72)}.commit-time{text-align:right;color:rgba(255,255,255,.52)}.popover-backdrop{position:fixed;inset:0;background:rgba(0,0,0,.55);display:flex;align-items:center;justify-content:center;padding:24px;z-index:50}.popover-backdrop[hidden]{display:none!important;pointer-events:none!important}.commit-popover{position:relative;width:min(100%,420px);border-radius:20px;border:1px solid rgba(255,255,255,.08);background:#121212;padding:20px;box-shadow:0 18px 48px rgba(0,0,0,.45)}.popover-close{position:absolute;right:16px;top:12px;border:0;background:transparent;color:rgba(255,255,255,.72);font-size:28px}
.activity-stack{display:flex;flex-direction:column;gap:24px}.activity-shell{border-radius:18px;background:#0b0b0b;padding:16px;color:#fff;overflow:auto}.activity-months{display:grid;grid-template-columns:repeat(53, minmax(10px,1fr));gap:4px;padding-left:42px;font-size:13px;color:rgba(255,255,255,.55);margin-bottom:12px}.activity-layout{display:flex;gap:12px}.activity-days{display:grid;grid-template-rows:repeat(7,1fr);gap:4px;width:30px;text-align:right;font-size:13px;color:rgba(255,255,255,.72)}.activity-grid{display:grid;grid-template-columns:repeat(53,minmax(10px,1fr));gap:4px;flex:1}.activity-week{display:grid;grid-template-rows:repeat(7,1fr);gap:4px}.activity-cell{display:block;aspect-ratio:1;border-radius:2px;border:1px solid rgba(255,255,255,.04)}.activity-cell.is-loading{animation:loading-wave 1.2s linear infinite}.activity-legend{display:flex;align-items:center;justify-content:flex-end;gap:8px;margin-top:12px;font-size:13px;color:rgba(255,255,255,.72)}.legend-spacer{flex:1}.legend-cell{width:12px;height:12px;border-radius:2px;border:1px solid rgba(255,255,255,.04);display:inline-block}@keyframes loading-wave{0%{filter:brightness(.9)}50%{filter:brightness(1.5)}100%{filter:brightness(.9)}}
.file-tree-shell{max-width:540px}.file-tree{border-radius:20px;border:1px solid rgba(255,255,255,.08);background:#0b0b0d;padding:12px}.tree-item{display:flex;align-items:center;gap:8px;width:100%;padding:6px 8px;border:0;background:transparent;color:rgba(255,255,255,.82);font-size:13px;text-align:left;border-radius:8px}.tree-item:hover{background:rgba(255,255,255,.06)}.tree-leaf{padding-left:29px;cursor:default}.tree-highlight{background:rgba(255,255,255,.08);color:#fff}.tree-caret{width:12px;color:#a1a1aa}.tree-children{margin-left:14px}.tree-name{white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
@media (max-width: 900px){.commit-row{grid-template-columns:minmax(0,1fr) 90px 32px 110px 90px;font-size:14px}.page-shell{padding:40px 16px}.hero h1{font-size:34px}}
@media (max-width: 720px){.repo-grid,.context-grid{grid-template-columns:1fr}.commit-graph{min-width:960px}.activity-shell{overflow-x:auto}}
`;
}

function buildScript() {
  return `const GITHUB_DOMAIN='github.com';const HF_DOMAIN='huggingface.co';
const commitRows=[...document.querySelectorAll('.commit-row')];
let activeBackdrop=null;
const closePopover=()=>{if(activeBackdrop){activeBackdrop.remove();activeBackdrop=null;}};
const createPopover=(commit)=>{closePopover();const backdrop=document.createElement('div');backdrop.className='popover-backdrop';backdrop.id='commit-popover-backdrop';backdrop.innerHTML=\`
  <div class="commit-popover" id="commit-popover" role="dialog" aria-modal="true">
    <button class="popover-close" id="commit-popover-close" type="button">×</button>
    <div id="commit-popover-content">
  <div style="display:flex;flex-direction:column;gap:16px">
    <div><div style="font-size:18px;font-weight:600;margin-bottom:8px">\${commit.message}</div><div style="display:flex;gap:8px;flex-wrap:wrap"><code style="background:rgba(255,255,255,.06);padding:6px 8px;border-radius:8px">\${commit.hash}</code>\${(commit.refs||[]).map(ref=>\`<span class="ref-badge">\${ref}</span>\`).join('')}\${commit.tag? \`<span class="ref-badge ref-tag">\${commit.tag}</span>\`:''}</div></div>
    <div style="border:1px solid rgba(255,255,255,.08);background:rgba(255,255,255,.03);border-radius:14px;padding:14px"><div style="font-weight:600">\${commit.author}</div><div style="font-size:12px;color:rgba(255,255,255,.55);margin-top:4px">\${commit.time}</div></div>
    <div style="display:flex;justify-content:space-between;gap:16px;font-size:14px"><span style="color:rgba(255,255,255,.55)">Topology lane</span><span>Rail \${commit.lane+1}</span></div>
  </div>
    </div>
  </div>\`;document.body.appendChild(backdrop);backdrop.querySelector('#commit-popover-close').addEventListener('click',closePopover);backdrop.addEventListener('click',(event)=>{if(event.target===backdrop) closePopover();});activeBackdrop=backdrop;};
commitRows.forEach((row)=>row.addEventListener('click',()=>{const commit=JSON.parse(row.dataset.commit.replaceAll('&apos;',\"'\"));createPopover(commit);}));
document.querySelectorAll('[data-tree-toggle]').forEach((button)=>button.addEventListener('click',()=>{const key=button.dataset.treeToggle;const group=document.querySelector('[data-tree-group=\"'+key+'\"]');const caret=button.querySelector('.tree-caret');const open=!group.hidden;group.hidden=open;button.classList.toggle('tree-open',!open);caret.textContent=open?'▸':'▾';}));
function validate(domain,input){const normalized=input.trim().replace(/^https?:\\/\\//i,'').replace(/^\\/+/, '').replace(/\\/+$/,'');if(!normalized)return{ok:true,value:null,error:null};const parts=normalized.split('/');if(parts[0]?.toLowerCase()!==domain)return{ok:false,value:null,error:\`Use \${domain}/owner/repo format.\`};if(parts.length!==3||!parts[1]||!parts[2])return{ok:false,value:null,error:\`Enter a full repo like \${domain}/google/repo.\`};return{ok:true,value:\`\${domain}/\${parts[1]}/\${parts[2]}\`,error:null};}
function bindInput(inputId, cardKind, hintId, normalizedId, domain, helper){const input=document.getElementById(inputId);const card=document.querySelector('[data-context-card=\"'+cardKind+'\"]');const hint=document.getElementById(hintId);const normalized=document.getElementById(normalizedId);const sync=()=>{const result=validate(domain,input.value);card.classList.toggle('is-invalid',!result.ok);hint.textContent=result.ok?helper:result.error;normalized.textContent=result.value || 'Invalid repo';};input.addEventListener('input',sync);sync();}
bindInput('github-input','github','github-hint','github-normalized',GITHUB_DOMAIN,'Needs a GitHub repo like github.com/google/repo');
bindInput('hf-input','huggingface','hf-hint','hf-normalized',HF_DOMAIN,'Needs a Hugging Face repo like huggingface.co/google/gemma-3-1b');
`;
}
