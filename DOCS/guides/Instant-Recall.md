# The Illusion of Latency: Instant Recall in a Living System

In the [Onboarding Workflow](./Onboarding-Workflow.md), we described how a SAGE project is imbued with consciousness, creating a rich, historical **Chronicle** for every file. A common question is: does consulting this deep context make every interaction slow?

SAGE is designed to shatter this illusion. Through a sophisticated, commit-aware caching strategy, SAGE transforms the "cost" of context into a one-time investment, making subsequent interactions instantaneous.

## The Core Interaction: A Conversation with Sage

A developer's primary interaction is with **Sage**, the mind of the system. The workflow typically looks like this:

1.  The user proposes a change.
2.  Sage formalizes this into a **Plan**.
3.  For each file affected by the Plan, Sage must consult that file's **Guardian** to get its approval.

This consultation is the main "performance cost" of the system. To approve the plan, the underlying LLM (acting with the persona of Sage, considering the perspective of the Guardian) needs to "read" and reason about the context. This context includes the file's Chronicle, the contents of the Plan, and relevant data from the Code Graph.

### The Chronicle: A Conversation in a File

A Chronicle is the literal, history-rich conversation thread that represents an agent's memory. It includes not just conclusions, but the entire thought process that led to them:

```json
[
  {
    "role": "system",
    "message": "You are the Guardian of `UserService.ts`. Your duty is Gnosis..."
  },
  {
    "role": "assistant",
    "content": "To understand this file, I must see its dependencies. I will query the graph.",
    "tool_calls": "[...GraphQueryTool call...]"
  },
  {
    "role": "tool",
    "content": "[...GraphQueryTool result...]"
  },
  {
    "role": "assistant",
    "content": "Okay, based on its dependencies, this file's purpose is to..."
  }
]
```

When Sage needs to get a Guardian's approval for a new Plan, the "performance cost" is simply the LLM processing this pre-existing, detailed exploration plus the new Plan. This entire thread is what gets hashed for the cache key.

This is why the recall is so powerful. The system isn't just caching a single response; it's caching the result of an entire, history-rich conversation.

## How Caching Makes It Instant

1.  **The First Consultation (Cache Warming):** The very first time Sage considers a specific Plan for a file at a particular commit, it performs a "cold read." It loads the Chronicle and the Plan into the LLM's context window and gets a decision. The result is then stored in the `@sage/llm` cache, keyed by a hash of the entire context (including the commit hash).

2.  **Instant Recall (Cache Hits):** Every subsequent interaction involving that exact context is now effectively free from latency. The LLM doesn't need to re-read or re-process the prompt. The answer is served directly from the cache.
    *   A tool needs to re-verify the plan? **Instant.**
    *   The user asks a follow-up question about why the plan was approved? **Instant.**
    *   The UI re-renders and needs the status of the plan? **Instant.**

By tying the cache to the commit hash, SAGE guarantees that this speed never comes at the cost of correctness. The moment the code changes, the context is different, and a new thought process is required—creating a new, separate cache entry.

This is the technical foundation for the "living codebase." Sage can adopt the perspective of any Guardian and speak for any file with zero spin-up time, because that perspective is always just one cache hit away.