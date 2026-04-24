# MTP (Multi-Tenant Prefix) v1 — prompt layout contract

Status: **v1 — frozen**. Implementation lives in `lib/server/bundle-spec/mtp.ts`. This document is the normative source for how the router composes prompts that hit vLLM with APC (automatic prefix caching) turned on.

Purpose: the exact byte sequence that becomes the model's system and user messages must be stable across identical logical inputs, so token-id prefixes match and APC hits. Any drift — added whitespace, reordered layers, alternate serialization — silently destroys the cache benefit.

## 1. Serialization mode (v1 only)

- `manifest.mtp.serialization_mode` **must** equal `"chat_messages"`.
- Raw-string serialization is **not** supported in `bundle_schema_version 1.x`. Attempting to build a prompt against a manifest with any other mode is a runtime error.
- Guided decoding (GBNF, `guided_json`, custom logits processors) is **not** supported in v1. Revisit in `bundle_schema_version 2.x` only with a separate APC measurement plan.

## 2. Layer order (deterministic)

`buildPrompt({ roleId, sessionId, userTurn, toolResults })` produces exactly two `ChatMessage`s:

1. `system` — concatenation of prefix layer files **in the order declared by `manifest.roles[].prefix_layer_ids`** for the requested `roleId`. Files are read from `prefixes/<layer_id>.txt`.
2. `user` — the volatile tail: all tool results (if any) followed by the user turn, framed by stable delimiters.

**Layer order in v1:** `global` → role-specific header layers (`orchestrator_header`, `executor_header`, etc.) → volatile tail (tool results then user turn). A role must reference at least one prefix layer in its `prefix_layer_ids`.

## 3. Delimiters (stable bytes)

These delimiters are the **exact bytes** the router writes into the user message. They are part of the cacheable prefix when every turn uses them identically, so they must not be template-rendered or conditionally omitted.

| Delimiter | Value (byte-exact) |
|-----------|--------------------|
| Tool result open | `<<<TOOL_RESULT>>>\n` |
| Tool result close | `\n<<<END_TOOL_RESULT>>>` |
| User open | `<<<USER>>>\n` |
| User close | `\n<<<END_USER>>>` |

A tool result block is written as `<<<TOOL_RESULT>>>\nrole=<role>\n<text>\n<<<END_TOOL_RESULT>>>`. Multiple tool results are joined by a single `\n`. The user turn is always appended last as `<<<USER>>>\n<text>\n<<<END_USER>>>`.

## 4. Whitespace and encoding

- Trailing newline presence/absence in each `prefixes/<layer_id>.txt` is **significant**. Golden tests lock these bytes per file. Do not trim on read.
- All prefix files and user-turn inputs are stored and compared in **Unicode NFC**. The router normalizes inputs to NFC before assembly so caller-side normalization drift does not flip APC matches.
- Tabs vs spaces are preserved as-written. Do not re-indent prefix files after a golden test exists.

## 5. Tokenization path (v1 contract)

The router builds OpenAI-style `messages[]` (system + user as described above) and hands them to the model tokenizer's `apply_chat_template` with `add_generation_prompt: true` on the final assistant turn path. APC matches on **token-id prefixes**, so the chat template is part of the contract. The runtime must call `apply_chat_template` at the same call site for every invocation of the same logical prefix layers.

## 6. Versioning

- Schema bumps (for example, adding a new delimiter or a new serialization mode) require incrementing `manifest.bundle_schema_version` major. Runtimes **refuse** to load bundles with an unknown major.
- Golden tests covering each delimiter and each layer order must be updated alongside the version bump.

## 7. Test commitments

The following tests accompany this doc and are required before a v1 bundle ships:

- `buildPrompt` returns exactly two messages (`system`, `user`) for a chat_messages manifest.
- System content for a role equals `layer files concatenated in declared order`, byte-for-byte.
- User content equals `<tool_results><user_delim_open><user_turn><user_delim_close>`, byte-for-byte.
- Repeated calls with identical inputs produce byte-identical outputs (prefix stability).
- Unknown `role_id` or missing prefix layer throws a descriptive error.
- `serialization_mode` other than `chat_messages` throws.
- NFC normalization: inputs with combining sequences canonicalize before assembly.

## 8. Non-goals (v1)

- Per-session dynamic prefixes (beyond what's composed from static layers).
- In-band role routing (picking a role from free-text content).
- Cross-role prefix sharing via symbolic references; a role's prefix is literal, declared layer ids only.
