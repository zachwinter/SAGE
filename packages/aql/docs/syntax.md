# AQL Syntax Specification

_Complete language reference for AQL (Agent/Action Query Language)_

## Table of Contents

- [Basic Syntax](#basic-syntax)
- [Data Types](#data-types)
- [Operations](#operations)
- [Control Flow](#control-flow)
- [Built-in Functions](#built-in-functions)
- [Agent Configuration](#agent-configuration)
- [Error Handling](#error-handling)
- [Advanced Features](#advanced-features)

## Basic Syntax

### Query Structure

Every AQL file starts with a query definition:

```aql
query QueryName($param1: Type, $param2: Type = defaultValue) {
  // Operations
}
```

### Variables

Variables are prefixed with `$` and can be:

- **Query parameters**: `$topic`, `$maxTokens`
- **Operation outputs**: Reference by operation name
- **Interpolated in prompts**: `{{variable}}`

```aql
query Example($topic: String!) {
  research: agent(model: "research-agent") {
    prompt: "Research {{topic}}"
    input: $topic
  }

  summary: agent(model: "summary-agent") {
    prompt: "Summarize: {{research}}"
    input: research  // References the research operation
  }
}
```

### Comments

```aql
// Single line comment
/* Multi-line
   comment */
```

## Data Types

### Primitive Types

```aql
String      // "hello world"
Int         // 42
Float       // 3.14
Boolean     // true, false
```

### Collection Types

```aql
[String]    // Array of strings
[Agent]     // Array of agent results
```

### Custom Types

```aql
type Article {
  title: String!
  content: String!
  tags: [String]
  wordCount: Int
}

type QualityScore {
  score: Float!
  feedback: String
  categories: {
    grammar: Float
    clarity: Float
    engagement: Float
  }
}
```

### Nullable vs Non-Nullable

```aql
String      // Nullable string
String!     // Non-nullable string (required)
[String]    // Nullable array of nullable strings
[String!]   // Nullable array of non-nullable strings
[String]!   // Non-nullable array of nullable strings
[String!]!  // Non-nullable array of non-nullable strings
```

## Operations

### Agent Operations

The core building block of AQL:

```aql
agent(
  model: "research-agent",       // Required: Agent identifier
  role: "analyst"               // Optional: System role
) {
  prompt: "Analyze {{data}}"      // Required: Prompt template
  input: $data                   // Required: Input data
  context: [previous_ops]        // Optional: Additional context

  // Agent parameters
  temperature: 0.7
  maxTokens: 1000
  topP: 0.9

  // Output configuration
  output: Article            // Optional: Structured output type
  streaming: true            // Optional: Enable streaming

  // Retry configuration
  retries: 3
  timeout: 30s
}
```

### Tool Operations

Integrate external tools and APIs:

```aql
tool(name: "web_search") {
  query: "{{search_term}}"
  maxResults: 5
}

tool(name: "calculator") {
  expression: "{{math_expression}}"
}

tool(name: "code_executor", language: "python") {
  code: "{{python_code}}"
  timeout: 10s
}
```

### Transform Operations

Data transformation and processing:

```aql
transform(input: data) {
  operation: "extract"
  pattern: /\b[A-Z][a-z]+\b/g  // Regex pattern
  format: "json"
}

transform(input: articles) {
  operation: "map"
  function: (item) => {
    title: item.title.toUpperCase()
    summary: item.content.substring(0, 100)
  }
}
```

## Control Flow

### Sequential Execution (Default)

Operations execute in order:

```aql
query Pipeline {
  step1: agent(model: "agent-1") { ... }
  step2: agent(model: "agent-2") { input: step1 }
  step3: agent(model: "agent-3") { input: step2 }
}
```

### Parallel Execution

Execute operations concurrently:

```aql
parallel {
  analysis: agent(model: "analysis-agent") {
    prompt: "Analyze {{data}}"
    input: $data
  }

  summary: agent(model: "summary-agent") {
    prompt: "Summarize {{data}}"
    input: $data
  }

  keywords: agent(model: "keyword-agent") {
    prompt: "Extract keywords from {{data}}"
    input: $data
  }
}
```

### Conditional Execution

```aql
if (condition) {
  // Execute if true
} else if (other_condition) {
  // Execute if other_condition is true
} else {
  // Execute if all conditions are false
}
```

Example:

```aql
quality_check: agent(model: "quality-agent") {
  prompt: "Rate content quality 1-10"
  input: content
  output: { score: Int }
}

result: if (quality_check.score >= 8) {
  approve: content
} else if (quality_check.score >= 5) {
  revision: agent(model: "revision-agent") {
    prompt: "Improve this content: {{content}}"
    input: content
  }
} else {
  rewrite: agent(model: "rewrite-agent") {
    prompt: "Completely rewrite: {{content}}"
    input: content
  }
}
```

### Loops

#### While Loop

```aql
counter: 0
result: while (counter < 5) {
  iteration: agent(model: "processing-agent") {
    prompt: "Process iteration {{counter}}"
    input: $data
  }
  counter: counter + 1
}
```

#### For Loop

```aql
items: ["apple", "banana", "orange"]
results: for (item in items) {
  process: agent(model: "processing-agent") {
    prompt: "Describe {{item}}"
    input: item
  }
}
```

#### Map Operation

```aql
articles: map(source_articles) {
  agent(model: "summary-agent") {
    prompt: "Summarize: {{item}}"
    input: item
  }
}
```

## Built-in Functions

### Text Processing

```aql
// Extract information
extract(text: content, pattern: "email") // Built-in patterns
extract(text: content, regex: /\b\w+@\w+\.\w+\b/)

// Transform text
transform(text: content, operation: "lowercase")
transform(text: content, operation: "trim")
transform(text: content, operation: "markdown_to_html")

// Validate content
validate(text: content, rules: ["length > 100", "contains_keywords"])
```

### Aggregation Functions

```aql
// Merge multiple results
merge(results: [analysis, summary, keywords])
merge(results: [intro, body, conclusion], separator: "\n\n")

// Concatenate strings
concat(texts: [title, "\n", content])

// Voting/consensus
vote(results: [agent1_result, agent2_result, agent3_result])
vote(results: opinions, method: "majority")

// Summarization
summarize(texts: [doc1, doc2, doc3])
summarize(texts: documents, maxLength: 500)
```

### Context Management

```aql
// Remember information across operations
remember(key: "user_preferences", value: preferences)
context: recall(key: "user_preferences")

// Forget information
forget(key: "temporary_data")

// Context window management
context: sliding_window(history: conversation, size: 10)
context: truncate(text: long_content, maxTokens: 2000)
```

### Utility Functions

```aql
// Time operations
now()
wait(duration: "5s")
timeout(operation: slow_agent, duration: "30s")

// Random operations
random(min: 1, max: 100)
sample(list: options, count: 3)
shuffle(list: items)

// Math operations
sum(numbers: [1, 2, 3, 4])
average(numbers: scores)
round(number: 3.14159, precision: 2)
```

## Agent Configuration

### Global Configuration

```aql
agents {
  researcher: {
    type: "research"
    capabilities: ["web_search", "document_analysis"]
    rateLimits: {
      requestsPerMinute: 60
    }
  }

  writer: {
    type: "creative"
    capabilities: ["text_generation", "style_transfer"]
    rateLimits: {
      requestsPerMinute: 50
    }
  }

  analyzer: {
    type: "analytical"
    capabilities: ["data_processing", "pattern_recognition"]
  }
}
```

### Per-Operation Configuration

```aql
agent(
  model: "research-agent",
  config: {
    temperature: 0.7,
    maxTokens: 1000,
    presencePenalty: 0.1,
    frequencyPenalty: 0.1
  }
) {
  prompt: "Generate creative content"
  input: $topic
}
```

## Error Handling

### Retry Logic

```aql
agent(model: "research-agent") {
  prompt: "Process {{data}}"
  input: $data

  // Retry configuration
  retries: 3
  retryDelay: "2s"
  retryBackoff: "exponential"

  // Retry conditions
  retryOn: ["timeout", "service_unavailable", "server_error"]
}
```

### Fallback Strategies

```aql
primary: agent(model: "primary-agent") {
  prompt: "Complex analysis of {{data}}"
  input: $data
  timeout: "30s"
}

result: fallback(primary) {
  secondary: agent(model: "secondary-agent") {
    prompt: "Basic analysis of {{data}}"
    input: $data
  }

  tertiary: agent(model: "tertiary-agent") {
    prompt: "Simple summary of {{data}}"
    input: $data
  }
}
```

### Try-Catch Blocks

```aql
result: try {
  risky_operation: agent(model: "experimental-agent") {
    prompt: "Complex task"
    input: $data
  }
} catch (error) {
  fallback: agent(model: "safe-agent") {
    prompt: "Safe fallback for {{data}}"
    input: $data
  }

  log: "Error occurred: {{error.message}}"
}
```

## Advanced Features

### Streaming

```aql
stream_result: agent(model: "writer-agent") {
  prompt: "Write a long story about {{topic}}"
  input: $topic
  streaming: true

  onChunk: (chunk) => {
    display(chunk.content)
  }

  onComplete: (result) => {
    save(result, "story.txt")
  }
}
```

### Caching

```aql
cached_result: agent(model: "expensive-agent") {
  prompt: "Expensive computation for {{data}}"
  input: $data

  cache: {
    enabled: true
    ttl: "1h"
    key: "computation_{{hash(data)}}"
  }
}
```

### Custom Functions

```aql
function extractEmails(text: String): [String] {
  return extract(text: text, regex: /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/g)
}

function qualityScore(content: String): Float {
  metrics: parallel {
    grammar: agent(model: "grammar-agent") {
      prompt: "Rate grammar 0-1: {{content}}"
      input: content
    }

    clarity: agent(model: "clarity-agent") {
      prompt: "Rate clarity 0-1: {{content}}"
      input: content
    }
  }

  return average([metrics.grammar, metrics.clarity])
}
```

### Imports and Modules

```aql
import { extractEmails, qualityScore } from "./utils.aql"
import * as textUtils from "./text-processing.aql"

query ProcessDocuments {
  emails: extractEmails(content)
  score: qualityScore(content)
  processed: textUtils.clean(content)
}
```

### Query Fragments

```aql
fragment QualityCheck on String {
  grammar: agent(model: "grammar-agent") {
    prompt: "Check grammar in: {{input}}"
    input: $input
  }

  readability: agent(model: "readability-agent") {
    prompt: "Rate readability 1-10: {{input}}"
    input: $input
  }
}

query ReviewContent {
  content: $input

  review: {
    ...QualityCheck

    seo: agent(model: "seo-agent") {
      prompt: "Analyze SEO potential: {{content}}"
      input: content
    }
  }
}
```

## Type System

### Type Definitions

```aql
type User {
  id: ID!
  name: String!
  email: String!
  age: Int
  preferences: UserPreferences
}

type UserPreferences {
  theme: Theme
  notifications: Boolean
  language: Language
}

enum Theme {
  LIGHT
  DARK
  AUTO
}

enum Language {
  EN
  ES
  FR
  DE
}
```

### Generic Types

```aql
type Result<T> {
  success: Boolean!
  data: T
  error: String
}

type PaginatedResult<T> {
  items: [T!]!
  totalCount: Int!
  hasNextPage: Boolean!
}
```

### Union Types

```aql
union SearchResult = Article | Video | Image

type Article {
  title: String!
  content: String!
  author: String!
}

type Video {
  title: String!
  duration: Int!
  url: String!
}

type Image {
  title: String!
  url: String!
  alt: String
}
```

---
This specification provides a comprehensive overview of AQL syntax. For more examples and use cases, see the [examples directory](../examples/).