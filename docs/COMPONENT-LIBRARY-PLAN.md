# Building an AI Component Library on This Repo

This doc outlines ways to turn **nexus-ui** into the docs site for a shadcn-based AI component library that works with Vercel AI SDK, ElevenLabs, and similar services.

---

## 1. Ways to Achieve This

### Option A: In-repo library (recommended to start)

- **Structure**: All library code lives in this repo (e.g. `components/nexus/`, `lib/nexus/`).
- **Docs**: Fumadocs in `content/docs/` imports and demos those components in MDX.
- **Pros**: Single repo, docs and components always in sync, no publish step to try demos.
- **Cons**: If you later publish to npm, you’ll need to add a build step and `package.json` exports.

### Option B: Monorepo (docs app + package)

- **Structure**: e.g. `packages/nexus-ui/` (the library) and this app as `apps/docs` (or keep root as docs).
- **Docs**: Docs app depends on the local package (`"nexus-ui": "workspace:*"`) and documents it.
- **Pros**: Clear separation, library can be versioned and published independently.
- **Cons**: More setup (pnpm/npm workspaces, possibly Turborepo), and you need to build the package for doc demos.

### Option C: Separate repo + npm package

- **Structure**: Component library in its own repo, published to npm; this repo only installs it and documents it.
- **Pros**: Clean split, library usable anywhere.
- **Cons**: Two repos, doc examples must stay in sync with published versions.

**Recommendation:** Start with **Option A**. Add shadcn and AI components under something like `components/nexus/`. Use Fumadocs to document them. Move to Option B later if you want to publish the library.

---

## 2. Building on the Fumadocs Template

### 2.1 Add shadcn (alongside Fumadocs UI)

- Fumadocs already brings Radix and its own UI; you can add shadcn for the *library* primitives.
- **Approach**: Initialize shadcn in a **namespaced** path so it doesn’t clash with Fumadocs:
  - Run: `npx shadcn@latest init` and choose a path like `components/ui` (or `components/nexus/ui`).
- In `components.json`, point to `components/ui` so shadcn components live there. Use the same Tailwind setup (you’re on Tailwind v4; ensure shadcn’s config is compatible or use their Tailwind v4 instructions).
- **Usage**: Build your **AI components** in e.g. `components/nexus/` and have them use `@/components/ui/*` (Button, Input, Card, etc.). Docs layout and nav stay on Fumadocs UI.

### 2.2 Docs structure for the library

Use the existing Fumadocs source and add a clear hierarchy under `content/docs/`:

```
content/docs/
  index.mdx                    # Overview + getting started
  installation.mdx             # How to install (or “use in this repo”)
  components/
    index.mdx                  # Component list / overview
    chat/
      index.mdx                # Chat UI overview
      message-list.mdx         # MessageList component
      chat-input.mdx           # ChatInput component
    voice/
      index.mdx
      voice-player.mdx         # ElevenLabs-style player
  integrations/
    vercel-ai-sdk.mdx         # useChat + your components
    elevenlabs.mdx            # Voice + your components
  examples/
    simple-chat.mdx            # Full example: Vercel AI SDK + your UI
```

- **meta.json**: Use Fumadocs meta files to define sidebar and order (see Fumadocs docs for `meta.json` in `content/docs/`).

### 2.3 Live demos in MDX

- **Pattern**: In each component doc, import the component and render it; add a code block (Fumadocs `<CodeBlock>`) for the source.
- Example for a “ChatBubble” doc:

```mdx
---
title: ChatBubble
description: A single message bubble for chat UIs
---

import { ChatBubble } from '@/components/nexus/chat/chat-bubble';
import { CodeBlock } from 'fumadocs-ui/components/codeblock';

## Demo

<ChatBubble role="user">Hello</ChatBubble>
<ChatBubble role="assistant">Hi there!</ChatBubble>

## Usage

<CodeBlock lang="tsx" title="chat-bubble.tsx" code={`...`} />
```

- For **interactive** demos (e.g. real `useChat`), you need a client component wrapper and possibly a small demo route or embedded iframe so the doc page can show a working chat. That’s doable with a `<ClientDemo />` that uses `useChat` and your components.

### 2.4 Integrations section

- **Vercel AI SDK**: Doc page that shows `useChat` (or `useCompletion`) with your `<MessageList>`, `<ChatInput>`, etc. Include a minimal code sample and, if possible, a runnable demo.
- **ElevenLabs**: Doc page for voice: playback, recording, or “speak this text” using your `<VoicePlayer>` (or similar) component.
- **Other AI services**: Same idea: one doc per integration, with snippet + optional demo.

### 2.5 Homepage and nav

- Update `lib/layout.shared.tsx`: set `nav.title` to your library name (e.g. “Nexus UI”).
- Update `app/(home)/page.tsx`: short tagline, link to “Docs”, “Components”, “Integrations”, “Examples”.
- In Fumadocs sidebar (via meta), expose: Getting started → Components (by category) → Integrations → Examples.

---

## 3. Concrete Next Steps

1. **Initialize shadcn** (Option A path):
   - `npx shadcn@latest init` → output to `components/ui`.
   - Add a few primitives you’ll need: `button`, `input`, `card`, `scroll-area`, `avatar` (for chat), etc.

2. **Create the Nexus component folders**:
   - `components/nexus/chat/` – e.g. `MessageList`, `ChatInput`, `ChatBubble`, `ChatContainer`.
   - `components/nexus/voice/` – e.g. `VoicePlayer`, `Waveform` (placeholders at first).
   - Design them to accept “slots” or props that work with Vercel AI SDK (`messages`, `input`, `handleSubmit`, `isLoading`) and with ElevenLabs (e.g. `src`, `onPlay`, `onPause`).

3. **Add dependencies** (when you’re ready for real integrations):
   - `ai` (Vercel AI SDK), `@ai-sdk/react` if needed.
   - ElevenLabs SDK or `@11labs/react` (or similar) for voice demos.
   - Install only when you actually build the integration docs/demos.

4. **Doc the first component**:
   - Add `content/docs/components/chat/chat-bubble.mdx` that imports `ChatBubble`, renders it, and shows code (and add a meta entry so it appears in the sidebar).

5. **Add one integration doc**:
   - e.g. `content/docs/integrations/vercel-ai-sdk.mdx` with a minimal `useChat` + your components example (and a client demo component if you want it live).

6. **Optional: LLM-friendly docs**:
   - You already have `llms.txt` / `llms.mdx` and “Copy Markdown”; keep that so AI tools can read your docs. Consider a short “Overview for AI” section in the main index that describes the library and how it fits with Vercel AI SDK / ElevenLabs.

---

## 4. Summary

- **Achieve the goal** by either keeping the library in-repo (Option A), or moving to a monorepo (Option B) / separate package (Option C) later.
- **Build on this Fumadocs template** by: adding shadcn under a dedicated path, creating `components/nexus/*` for AI building blocks, structuring `content/docs/` (components, integrations, examples), and using MDX to import and demo components plus integration snippets.
- That gives you a single repo where the docs are the source of truth and the same codebase can later be split into a published package if needed.
