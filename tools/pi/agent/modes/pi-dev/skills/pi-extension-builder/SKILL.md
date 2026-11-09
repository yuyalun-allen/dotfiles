---
name: pi-extension-builder
description: >
  Guide for creating high-quality pi coding agent extensions in TypeScript.
  Use this skill whenever the user wants to create, modify, debug, or understand
  pi extensions — including custom tools, slash commands, event handlers,
  keyboard shortcuts, CLI flags, custom UI components, provider registrations,
  and stateful extension patterns. Also use when the user asks about pi's
  extension API, lifecycle events, session management, or any customization
  of pi's behavior via TypeScript. This skill covers everything from simple
  single-file extensions to multi-file packages with npm dependencies.
---

# Pi Extension Development Guide

## Overview

Pi extensions are TypeScript modules that extend pi's behavior. They can subscribe to lifecycle events, register custom tools callable by the LLM, add slash commands, register keyboard shortcuts and CLI flags, manage state that persists across sessions, and render custom UI.

## Architecture

### File Structure

Extensions can be structured in two ways:

**Single file (simple):**
```
~/.config/pi/agent/extensions/my-ext.ts
```

**Multi-file with dependencies:**
```
~/.config/pi/agent/extensions/my-ext/
├── package.json        # npm dependencies declared here
├── package-lock.json
├── node_modules/       # after npm install
└── src/
    └── index.ts        # entry point, exports default function
```

```jsonc
// package.json
{
  "name": "my-ext",
  "dependencies": {
    "chalk": "^5.0.0"
  },
  "pi": {
    "extensions": ["./src/index.ts"]  // entry point(s)
  }
}
```

### Entry Point Pattern

Every extension exports a default function that receives `ExtensionAPI`:

```typescript
import type { ExtensionAPI } from "@mariozechner/pi-coding-agent";

export default function (pi: ExtensionAPI) {
  // Subscribe to events
  pi.on("event_name", async (event, ctx) => { ... });

  // Register custom tools
  pi.registerTool({ ... });

  // Register slash commands
  pi.registerCommand("name", { ... });

  // Register keyboard shortcuts
  pi.registerShortcut("ctrl+shift+p", { ... });

  // Register CLI flags
  pi.registerFlag("my-flag", { ... });
}
```

### Available Imports

| Package | Purpose |
|---------|---------|
| `@mariozechner/pi-coding-agent` | Extension API types, `SessionManager`, utilities (`withFileMutationQueue`, `truncateHead`, `isToolCallEventType`, `createLocalBashOperations`, etc.) |
| `@sinclair/typebox` | Schema definitions for tool parameters (`Type.Object`, `Type.String`, `Type.Array`, etc.) |
| `@mariozechner/pi-ai` | AI utilities (`StringEnum` for Google-compatible enums) |
| `@mariozechner/pi-tui` | TUI components (`Text`, `Container`, `Box`, `SettingsList`, `matchesKey`, `truncateToWidth`) |
| Node.js built-ins | `node:fs`, `node:path`, `node:child_process`, etc. |

npm dependencies work too. Add `package.json` next to your extension, run `npm install`, and imports from `node_modules/` are resolved automatically.

## Core Patterns

### Pattern 1: Custom Tool

```typescript
import { Type } from "@sinclair/typebox";
import { StringEnum } from "@mariozechner/pi-ai";
import type { ExtensionAPI } from "@mariozechner/pi-coding-agent";

export default function (pi: ExtensionAPI) {
  pi.registerTool({
    name: "my_tool",
    label: "My Tool",
    description: "Explains what this tool does to the LLM",
    promptSnippet: "Short one-liner for Available tools section",
    promptGuidelines: [
      "Tool-specific usage guidelines appended to system prompt when this tool is active.",
    ],
    parameters: Type.Object({
      action: StringEnum(["list", "add", "delete"] as const),
      text: Type.Optional(Type.String({ description: "Text content" })),
    }),

    async execute(_toolCallId, params, _signal, _onUpdate, _ctx) {
      return {
        content: [{ type: "text", text: `Action: ${params.action}` }],
        details: {},
      };
    },
  });
}
```

**Key points:**
- `name` must be snake_case (lowercase, numbers, underscores)
- Use `StringEnum()` from `@mariozechner/pi-ai` for string enums instead of `Type.Union(Type.Literal(...))` — `Type.Union` doesn't work with Google's API
- `promptSnippet` adds a one-line entry to `Available tools` in the system prompt
- `promptGuidelines` adds bullets to `Guidelines` in the system prompt (only when tool is active)
- Signal errors by **throwing** — returning never sets `isError: true`

### Pattern 2: Slash Command

```typescript
import type { ExtensionAPI } from "@mariozechner/pi-coding-agent";

export default function (pi: ExtensionAPI) {
  pi.registerCommand("my-cmd", {
    description: "What this command does",
    getArgumentCompletions: (prefix: string) => {
      const options = ["opt1", "opt2"].filter((o) => o.startsWith(prefix));
      return options.length > 0
        ? options.map((o) => ({ value: o, label: o }))
        : null;
    },
    handler: async (args, ctx) => {
      // args: the text after the command name
      // ctx has full ExtensionCommandContext (waitForIdle, newSession, switchSession, etc.)
      ctx.ui.notify(`Command ran with: ${args}`, "info");
    },
  });
}
```

**Key points:**
- Command handlers receive `ExtensionCommandContext` which extends `ExtensionContext` with `waitForIdle()`, `newSession()`, `fork()`, `switchSession()`, `navigateTree()`, and `reload()`
- These session control methods are only available in commands (not in event handlers or tool executes) to avoid deadlocks

### Pattern 3: Event Interception

```typescript
import type { ExtensionAPI } from "@mariozechner/pi-coding-agent";

export default function (pi: ExtensionAPI) {
  // Block dangerous bash commands
  pi.on("tool_call", async (event, ctx) => {
    if (event.toolName !== "bash") return;
    if (event.input.command?.includes("rm -rf")) {
      const ok = await ctx.ui.confirm("Dangerous!", "Allow rm -rf?");
      if (!ok) return { block: true, reason: "Blocked by user" };
    }
  });

  // Intercept and transform first user input
  pi.on("input", async (event, ctx) => {
    if (event.text.startsWith("?quick ")) {
      return { action: "transform", text: `Respond briefly: ${event.text.slice(7)}` };
    }
    return { action: "continue" }; // Let it pass through
  });

  // Inject context before each agent turn
  pi.on("before_agent_start", async (event, ctx) => {
    return {
      message: {
        customType: "my-extension",
        content: "Remember to check the README first",
        display: true,
      },
      systemPrompt: event.systemPrompt + "\n\nExtra instructions for this turn...",
    };
  });
}
```

**Available events (simplified lifecycle):**

```
session_start → (reconstruct state)
     ↓
user prompt → input (intercept/transform)
     ↓
before_agent_start (inject message, modify system prompt)
     ↓
[Turn loop:]
  turn_start → before_provider_request → after_provider_response
    → tool_call (can block) → tool_result (can modify) → turn_end
     ↓
agent_end → (wait for next prompt)
     ↓
session_shutdown (on exit)
     ↓
session_before_switch / session_before_fork / session_before_compact
```

### Pattern 4: State Management with Branching

State must survive branching. **Always store state in tool result `details`**, not in external files:

```typescript
interface MyDetails {
  items: string[];
  nextId: number;
}

export default function (pi: ExtensionAPI) {
  let items: string[] = [];
  let nextId = 1;

  // Reconstruct state from session on start/tree navigation
  const reconstruct = (ctx: ExtensionContext) => {
    items = [];
    nextId = 1;
    for (const entry of ctx.sessionManager.getBranch()) {
      if (entry.type !== "message") continue;
      const msg = entry.message;
      if (msg.role !== "toolResult" || msg.toolName !== "my_tool") continue;
      const details = msg.details as MyDetails;
      if (details) {
        items = details.items;
        nextId = details.nextId;
      }
    }
  };

  pi.on("session_start", async (_e, ctx) => reconstruct(ctx));
  pi.on("session_tree", async (_e, ctx) => reconstruct(ctx));

  pi.registerTool({
    name: "my_tool",
    ...,
    async execute(_id, params, _sig, _upd, _ctx) {
      items.push("new");
      return {
        content: [{ type: "text", text: "Added" }],
        details: { items: [...items], nextId: nextId++ } as MyDetails,
      };
    },
  });
}
```

For simple extension state that doesn't participate in LLM context, use `pi.appendEntry()`:

```typescript
pi.appendEntry("my-state", { count: 42 });

// Restore on reload/session_start:
pi.on("session_start", async (_event, ctx) => {
  for (const entry of ctx.sessionManager.getEntries()) {
    if (entry.type === "custom" && entry.customType === "my-state") {
      // Reconstruct from entry.data
    }
  }
});
```

### Pattern 5: Custom Rendering (TUI)

Tools can provide `renderCall` and `renderResult` for custom TUI display:

```typescript
import { Text } from "@mariozechner/pi-tui";

pi.registerTool({
  name: "my_tool",
  ...,
  renderCall(args, theme, _context) {
    let text = theme.fg("toolTitle", theme.bold("my_tool "));
    text += theme.fg("muted", args.action);
    return new Text(text, 0, 0);
  },
  renderResult(result, { expanded, isPartial }, theme, _context) {
    if (isPartial) {
      return new Text(theme.fg("warning", "Processing..."), 0, 0);
    }
    return new Text(theme.fg("success", "✓ Done"), 0, 0);
  },
});
```

Message renderers for custom messages (sent via `pi.sendMessage()`):

```typescript
pi.registerMessageRenderer("my-type", (message, { expanded }, theme) => {
  let text = theme.fg("accent", `[${message.customType}] ${message.content}`);
  if (expanded && message.details) {
    text += "\n" + theme.fg("dim", JSON.stringify(message.details));
  }
  return new Text(text, 0, 0);
});
```

**Theme color functions:**
- `theme.fg("accent", text)` / `theme.fg("success", text)` / `theme.fg("error", text)`
- `theme.fg("warning", text)` / `theme.fg("muted", text)` / `theme.fg("dim", text)`
- `theme.fg("toolTitle", text)` / `theme.fg("text", text)` / `theme.fg("borderMuted", text)`
- `theme.bg("customMessageBg", text)` / `theme.bold(text)` / `theme.italic(text)` / `theme.strikethrough(text)`

### Pattern 6: File Mutation (withFileMutationQueue)

When your custom tool modifies files, use `withFileMutationQueue()` to prevent race conditions with parallel tool calls:

```typescript
import { withFileMutationQueue } from "@mariozechner/pi-coding-agent";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";

async execute(_id, params, _sig, _upd, ctx) {
  const absPath = resolve(ctx.cwd, params.path);

  return withFileMutationQueue(absPath, async () => {
    await mkdir(dirname(absPath), { recursive: true });
    const current = await readFile(absPath, "utf8");
    const next = current.replace(params.oldText, params.newText);
    await writeFile(absPath, next, "utf8");
    return { content: [{ type: "text", text: "Done" }], details: {} };
  });
}
```

Without the queue, two tools can read the same old content, compute different updates, and the last write overwrites the other.

### Pattern 7: Output Truncation

Tools MUST truncate output to avoid overwhelming LLM context:

```typescript
import {
  truncateHead, truncateTail, formatSize,
  DEFAULT_MAX_BYTES, DEFAULT_MAX_LINES,
} from "@mariozechner/pi-coding-agent";

async execute(_id, params, _sig, _upd, _ctx) {
  const output = await runLongCommand();

  const trunc = truncateTail(output, { maxLines: DEFAULT_MAX_LINES, maxBytes: DEFAULT_MAX_BYTES });
  let result = trunc.content;

  if (trunc.truncated) {
    result += `\n\n[Output truncated: ${trunc.outputLines}/${trunc.totalLines} lines`;
    result += ` (${formatSize(trunc.outputBytes)}/${formatSize(trunc.totalBytes)})]`;
  }

  return { content: [{ type: "text", text: result }], details: {} };
}
```

- Use `truncateHead` for file reads/search results (beginning matters)
- Use `truncateTail` for logs/command output (end matters)

### Pattern 8: User Interaction Dialogs

```typescript
// Select from options
const choice = await ctx.ui.select("Pick:", ["A", "B", "C"]);

// Confirm dialog
const ok = await ctx.ui.confirm("Delete?", "This cannot be undone");

// Text input
const name = await ctx.ui.input("Name:", "placeholder");

// Multi-line editor
const text = await ctx.ui.editor("Edit:", "prefilled");

// Notification (non-blocking)
ctx.ui.notify("Done!", "info");  // info | warning | error

// Persistent footer status
ctx.ui.setStatus("my-ext", "Processing...");

// Widget above/below editor
ctx.ui.setWidget("my-widget", ["Line 1", "Line 2"]);
ctx.ui.setWidget("my-widget", (tui, theme) => new Text(theme.fg("accent", "Custom"), 0, 0));
ctx.ui.setWidget("my-widget", undefined);  // Clear

// Custom footer (replaces default)
ctx.ui.setFooter((tui, theme) => ({
  render(width) { return [theme.fg("dim", "Custom footer")]; },
  invalidate() {},
}));
ctx.ui.setFooter(undefined);  // Restore default
```

For complex custom UI, use `ctx.ui.custom()`:

```typescript
const result = await ctx.ui.custom<boolean>((tui, theme, keybindings, done) => {
  const text = new Text("Press Enter to confirm, Escape to cancel", 1, 1);
  text.onKey = (key) => {
    if (key === "return") done(true);
    if (key === "escape") done(false);
    return true;
  };
  return text;
});
```

### Pattern 9: Dynamic Tool Registration

Tools can be registered at any time, not just at extension load:

```typescript
pi.on("session_start", (_event, ctx) => {
  pi.registerTool({ name: "session_tool", ... });
});

pi.registerCommand("add-tool", {
  handler: async (args, ctx) => {
    pi.registerTool({ name: args, ... });
    ctx.ui.notify(`Registered: ${args}`, "info");
  },
});
```

New tools are immediately available in the same session without `/reload`.

### Pattern 10: Provider Registration

```typescript
pi.registerProvider("my-proxy", {
  baseUrl: "https://proxy.example.com",
  apiKey: "PROXY_API_KEY",
  api: "anthropic-messages",
  models: [{
    id: "claude-sonnet-4-20250514",
    name: "Claude 4 Sonnet (proxy)",
    reasoning: false,
    input: ["text", "image"],
    cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 },
    contextWindow: 200000,
    maxTokens: 16384,
  }],
});
```

### Pattern 11: Session Management Commands

```typescript
import { SessionManager } from "@mariozechner/pi-coding-agent";

pi.registerCommand("switch-session", {
  description: "Switch to another session",
  handler: async (_args, ctx) => {
    const sessions = await SessionManager.list(ctx.cwd);
    const choice = await ctx.ui.select("Pick session:",
      sessions.map(s => s.file));
    if (choice) await ctx.switchSession(choice);
  },
});
```

### Pattern 12: Keyboard Shortcuts

```typescript
pi.registerShortcut("ctrl+shift+p", {
  description: "Toggle something",
  handler: async (ctx) => {
    ctx.ui.notify("Toggled!", "info");
  },
});
```

### Pattern 13: CLI Flags

```typescript
pi.registerFlag("plan", {
  description: "Start in plan mode",
  type: "boolean",
  default: false,
});

// Check value:
if (pi.getFlag("--plan")) { ... }
```

### Pattern 14: Custom Bash Operations

Override or wrap bash execution (for SSH, sandbox, etc.):

```typescript
import { createLocalBashOperations } from "@mariozechner/pi-coding-agent";

pi.on("user_bash", (_event, ctx) => {
  const local = createLocalBashOperations();
  return {
    operations: {
      exec(command, cwd, options) {
        return local.exec(`source ~/.profile\n${command}`, cwd, options);
      },
    },
  };
});
```

### Pattern 15: Inter-Extension Communication

```typescript
// Extension A emits
pi.events.emit("my:event", { data: 42 });

// Extension B listens
pi.events.on("my:event", (data) => {
  console.log(data); // { data: 42 }
});
```

## Best Practices

1. **State in details, not files.** Store mutable state in tool result `details` and reconstruct from `ctx.sessionManager.getBranch()` on session start/tree navigation. This automatically handles branching correctly.

2. **Use `withFileMutationQueue` for file writes.** Prevents race conditions when your tool and another tool modify the same file in the same assistant turn.

3. **Use `StringEnum` for string unions.** `Type.Union(Type.Literal(...))` breaks with Google's API. Import from `@mariozechner/pi-ai`.

4. **Truncate tool output.** Always apply `truncateHead`/`truncateTail` to prevent context overflow. Inform the LLM when truncation happens.

5. **Use `prepareArguments` for backward compatibility.** When you change a tool's parameter schema, use `prepareArguments` to fold old argument shapes into the current schema. This ensures resumed sessions with old tool calls still work.

6. **Throw to signal errors.** Returning a value never sets `isError: true`. To mark a tool execution as failed, throw an Error.

7. **Handle `isPartial` in renderResult.** When the tool is streaming partial results, show a progress indicator.

8. **Check `ctx.hasUI` before dialogs.** In print/JSON/RPC mode, dialog methods may be no-ops. Use `if (!ctx.hasUI) return` before `ctx.ui.select/confirm/input`.

9. **Normalize `@` prefix in path args.** Some models include a leading `@` in path arguments. Strip it before resolving: `path.replace(/^@/, "")`.

10. **Use `ctx.signal` for abort-aware async work.** Pass it to `fetch()`, file operations, and subprocess calls so they respect cancellation.

11. **Keep SKILL.md under 500 lines.** If the extension has lots of reference material, move it to a `reference/` subfolder.

## Real-world Examples

All examples at `/opt/pi-coding-agent/examples/extensions/`:

| Pattern | File | Key APIs |
|---------|------|----------|
| Minimal tool | `hello.ts` | `registerTool`, `defineTool` |
| Command + tool | `commands.ts` | `registerCommand`, `getCommands` |
| Stateful tool | `todo.ts` | `registerTool`, `renderCall`, `renderResult`, session events |
| Event interception | `permission-gate.ts` | `on("tool_call")`, `ui.confirm` |
| Dynamic tools | `dynamic-tools.ts` | `registerTool` after startup |
| Message rendering | `message-renderer.ts` | `registerMessageRenderer`, `sendMessage` |
| Tool configuration | `tools.ts` | `setActiveTools`, `SettingsList`, `getAllTools` |
| Session management | `session-name.ts` | `setSessionName`, `getSessionName` |
| Custom UI | `snake.ts`, `space-invaders.ts` | `ui.custom` |
| Provider registration | `custom-provider-anthropic/` | `registerProvider` |
| SSH delegation | `ssh.ts` | `user_bash`, `createLocalBashOperations`, tool operations |
| Output truncation | `truncated-tool.ts` | `truncateHead`, `truncateTail` |
| Compact summary | `custom-compaction.ts` | `on("session_before_compact")` |
| Full plan mode | `plan-mode/` | All patterns combined |
| File mutation | `todo.ts` (uses details) | `withFileMutationQueue` (pattern) |

## Design Principles

- **Extensions are like VS Code extensions for pi** — they add capabilities without forking pi
- **Prioritize comprehensive API coverage** over narrow workflow tools, unless the workflow is genuinely common and complex
- **Error messages should guide the LLM toward solutions** with specific suggestions
- **Tool names should be descriptive** — use action-oriented naming (e.g., `db_query`, not `db`)
- **Keep extensions focused** — one extension per concern. Compose multiple extensions for different needs
- **Handle both interactive and non-interactive modes** — check `ctx.hasUI` before dialogs
