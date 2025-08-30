/**
 * @sage/ui - Renderer-agnostic UI primitives
 * 
 * This package exports platform-neutral primitives that can be adapted
 * to both CLI (Ink) and Web (React DOM) renderers.
 */

// Core primitives
export * from "./primitives.js";

// Streaming components
export * from "./components.js";

// Theme system
export * from "./theme.js";

// Type re-exports
export type { StreamEvent } from "@sage/llm";