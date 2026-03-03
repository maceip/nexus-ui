<p align="center">
  <h1 align="center">nexus-ui</h1>
</p>

<p align="center">
  Beautiful, composable components for building AI applications.
</p>

<p align="center">
  <a href="https://nexus-ui.dev">Documentation</a> ·
  <a href="https://nexus-ui.dev/docs/components">Components</a> ·
  <a href="https://nexus-ui.dev/docs/recipes">Recipes</a>
</p>

---

## About

nexus-ui is a design-first component library for building AI-powered applications. It provides a set of composable primitives that integrate seamlessly with the [Vercel AI SDK](https://sdk.vercel.ai), [ElevenLabs](https://elevenlabs.io), and other AI services.

Think of it as **shadcn/ui, but purpose-built for AI apps**.

Instead of adapting general-purpose components for AI use cases, nexus-ui is designed from the ground up for streaming, voice, multimodal, and agentic interfaces.

## Why nexus-ui?

- **AI-native** - Built for streaming, tool calls, voice, and multimodal from day one.
- **Design-first** - Every component looks exceptional out of the box. Polished animations, transitions, and micro-interactions.
- **Composable** - Small, single-purpose primitives that compose into full experiences. Use as much or as little as you need.
- **AI SDK compatible** - Works seamlessly with `useChat` and the full Vercel AI SDK surface area.
- **Voice-first** - First-class components for voice input, audio playback, and real-time transcription.
- **Accessible** - ARIA live regions for streaming content, focus management, keyboard navigation, and screen reader support.
- **Themeable** - Ships with beautiful theme presets. Compatible with shadcn/ui themes.
- **Copy-paste ownership** - You own the code. Not a dependency.

## Components

### Chat

The core primitives for building conversational AI interfaces.

| Component        | Description                                             |
| ---------------- | ------------------------------------------------------- |
| `ChatContainer`  | Scrollable viewport with auto-scroll and virtualization |
| `Message`        | Container for a single message, styled by role          |
| `MessageContent` | Renders markdown, code, images, and citations           |
| `MessageActions` | Action button container (copy, regenerate, feedback)    |
| `ChatInput`      | Auto-resizing textarea with submit handling             |
| `StreamingText`  | Renders streaming tokens with cursor animation          |
| `CodeBlock`      | Syntax-highlighted code with copy support               |
| `Avatar`         | User/assistant avatar with fallback                     |

### Feedback & Actions

| Component          | Description                               |
| ------------------ | ----------------------------------------- |
| `CopyButton`       | Copy message or code content to clipboard |
| `RegenerateButton` | Retry response generation                 |
| `FeedbackButtons`  | Thumbs up/down for response quality       |
| `EditButton`       | Edit a sent message                       |

### State & Status

| Component          | Description                                 |
| ------------------ | ------------------------------------------- |
| `LoadingIndicator` | AI "thinking" state before streaming begins |
| `EmptyState`       | Welcome screen when no messages exist       |
| `SuggestedPrompts` | Clickable conversation starters             |
| `TokenCounter`     | Visual token usage meter                    |
| `ModelBadge`       | Current model indicator                     |

### Voice

Components for voice-enabled AI applications.

| Component           | Description                              |
| ------------------- | ---------------------------------------- |
| `VoiceOrb`          | Animated audio visualizer during speech  |
| `PushToTalk`        | Hold-to-record with visual feedback      |
| `LiveTranscription` | Real-time speech-to-text display         |
| `VoiceSelector`     | Voice picker with preview playback       |
| `AudioPlayer`       | TTS playback with waveform visualization |

### Advanced

| Component        | Description                                         |
| ---------------- | --------------------------------------------------- |
| `ToolCallCard`   | Visualizes function calls with args, status, result |
| `SourceCitation` | RAG citation cards with links and snippets          |
| `ApprovalGate`   | "Agent wants to do X" approve/deny UI               |
| `ImagePreview`   | Image display with lightbox and actions             |
| `FileUpload`     | File attachment with progress and preview           |

## Quick Start

```bash
npx nexus-ui@latest init
```

Add components:

```bash
npx nexus-ui@latest add message chat-input streaming-text
```

## Usage

### Basic Chatbot

```tsx
import { useChat } from '@ai-sdk/react'
import {
  ChatContainer,
  Message,
  MessageContent,
  ChatInput,
  StreamingText,
} from '@nexus-ui/components'

export function Chatbot() {
  const { messages, input, handleInputChange, handleSubmit, isLoading } = useChat()

  return (
    <ChatContainer>
      {messages.map((m) => (
        <Message key={m.id} role={m.role}>
          <MessageContent>{m.content}</MessageContent>
        </Message>
      ))}

      <ChatInput
        value={input}
        onChange={handleInputChange}
        onSubmit={handleSubmit}
        loading={isLoading}
      />
    </ChatContainer>
  )
}
```

### With Actions

```tsx
import { useChat } from '@ai-sdk/react'
import {
  ChatContainer,
  Message,
  MessageContent,
  MessageActions,
  ChatInput,
  Avatar,
  CopyButton,
  RegenerateButton,
  FeedbackButtons,
} from '@nexus-ui/components'

export function Chatbot() {
  const { messages, input, handleInputChange, handleSubmit, reload, isLoading } = useChat()

  return (
    <ChatContainer>
      {messages.map((m) => (
        <Message key={m.id} role={m.role}>
          <Avatar role={m.role} />
          <MessageContent>{m.content}</MessageContent>
          <MessageActions>
            <CopyButton content={m.content} />
            <RegenerateButton onClick={reload} />
            <FeedbackButtons messageId={m.id} />
          </MessageActions>
        </Message>
      ))}

      <ChatInput
        value={input}
        onChange={handleInputChange}
        onSubmit={handleSubmit}
        loading={isLoading}
      />
    </ChatContainer>
  )
}
```

### Voice Assistant

```tsx
import { useChat } from '@ai-sdk/react'
import {
  ChatContainer,
  Message,
  MessageContent,
  ChatInput,
  VoiceOrb,
  VoiceInput,
  AudioPlayer,
} from '@nexus-ui/components'

export function VoiceAssistant() {
  const { messages, input, handleInputChange, handleSubmit, isLoading } = useChat()

  return (
    <ChatContainer>
      <VoiceOrb active={isLoading} />

      {messages.map((m) => (
        <Message key={m.id} role={m.role}>
          <MessageContent>{m.content}</MessageContent>
          {m.role === 'assistant' && <AudioPlayer src={m.audio} />}
        </Message>
      ))}

      <ChatInput
        value={input}
        onChange={handleInputChange}
        onSubmit={handleSubmit}
        loading={isLoading}
        slots={{
          leading: <VoiceInput onTranscript={handleInputChange} />,
        }}
      />
    </ChatContainer>
  )
}
```

## Recipes

Full, production-ready implementations built with nexus-ui primitives.

| Recipe               | Description                                                     |
| -------------------- | --------------------------------------------------------------- |
| Customer Support Bot | Chat with knowledge base, handoff, and satisfaction rating      |
| Code Assistant       | Chat with syntax highlighting, code execution, and file context |
| Search Assistant     | Perplexity-style search with sources and citations              |
| Voice Assistant      | Full voice conversation with ElevenLabs integration             |
| RAG Application      | Upload documents and chat with them                             |

## Theming

nexus-ui ships with theme presets that work out of the box.

```tsx
import { NexusProvider } from '@nexus-ui/components'

// Use a preset
<NexusProvider theme="midnight">
  <Chatbot />
</NexusProvider>
```

Available presets: `default`, `midnight`, `terminal`, `soft`, `corporate`.

All themes are compatible with shadcn/ui design tokens.

## Integrations

| Service       | Status    |
| ------------- | --------- |
| Vercel AI SDK | Supported |
| ElevenLabs    | Supported |
| Deepgram      | Planned   |
| Replicate     | Planned   |
| Fal           | Planned   |

## Tech Stack

- React 19
- TypeScript
- Tailwind CSS v4
- Radix UI Primitives
- Vercel AI SDK

## Contributing

We welcome contributions. Please read our [contributing guide](CONTRIBUTING.md) before submitting a pull request.

## License

MIT

---

<p align="center">
  Built by <a href="https://x.com/nexus_ui">@nexus_ui</a>
</p>
