# STORY: Extract UI Components to @sage/ui

## Overview
Extract the comprehensive React/Ink UI system from the CLI into a reusable `@sage/ui` package, creating shared components for chat interfaces, tool displays, and agent interactions across all SAGE applications.

## Current State
The CLI contains a sophisticated UI system built with React and Ink:
- ✅ Complete component library in `src/components/`
- ✅ Chat interface with streaming text display
- ✅ Tool call confirmation UI with syntax highlighting
- ✅ Navigation and routing components
- ✅ Form inputs and interactive elements
- ✅ Theme system and consistent styling
- ✅ Error handling and loading states

## Success Criteria
- [ ] `@sage/ui` package created with all CLI components
- [ ] Chat components working with streaming support
- [ ] Tool call display and confirmation UI extracted
- [ ] Navigation and form components generalized
- [ ] Theme system and styling preserved
- [ ] CLI updated to consume `@sage/ui` components
- [ ] Component documentation and examples
- [ ] All visual functionality preserved

## Implementation Plan

### Step 1: Create @sage/ui Package Structure
```bash
packages/ui/
├── src/
│   ├── index.ts              # Main exports
│   ├── components/
│   │   ├── chat/             # Chat-related components
│   │   │   ├── Chat.tsx
│   │   │   ├── ChatMessage.tsx
│   │   │   ├── ChatInput.tsx
│   │   │   ├── AssistantTurn.tsx
│   │   │   ├── UserMessage.tsx
│   │   │   └── ToolCall.tsx
│   │   ├── layout/           # Layout components
│   │   │   ├── Box.tsx
│   │   │   ├── Column.tsx
│   │   │   ├── Row.tsx
│   │   │   ├── View.tsx
│   │   │   ├── List.tsx
│   │   │   └── AsyncView.tsx
│   │   ├── content/          # Content display
│   │   │   ├── Text.tsx
│   │   │   ├── Code.tsx
│   │   │   ├── Error.tsx
│   │   │   ├── Command.tsx
│   │   │   └── Search.tsx
│   │   ├── input/            # Input components
│   │   │   ├── TextInput.tsx
│   │   │   ├── SearchableSelect.tsx
│   │   │   └── SearchableMultiSelect.tsx
│   │   ├── common/           # Common components
│   │   │   ├── Spinner.tsx
│   │   │   └── Header.tsx
│   │   └── providers/        # Context providers
│   │       ├── ThemeProvider.tsx
│   │       └── ConfigProvider.tsx
│   ├── hooks/                # Shared hooks
│   │   ├── useAsyncData.ts
│   │   └── useChatNavigation.ts
│   ├── theme/                # Theme system
│   │   ├── colors.ts
│   │   ├── theme.ts
│   │   └── index.ts
│   └── types/                # Component types
│       ├── chat.ts
│       ├── layout.ts
│       └── common.ts
├── examples/                 # Component examples
├── package.json
├── tsconfig.json
└── README.md
```

### Step 2: Extract Core Component Categories

#### Chat Components
From CLI `src/components/chat/`:
- `Chat.tsx` - Main chat container with streaming support
- `ChatMessage.tsx` - Individual message rendering
- `ChatInput.tsx` - Message input with controls
- `AssistantTurn.tsx` - Assistant response display
- `UserMessage.tsx` - User message display  
- `ToolCall.tsx` - Tool call display with confirmation UI

Key features to preserve:
- Streaming text animation
- Tool call syntax highlighting
- Confirmation flow UI
- Message threading
- Auto-scroll behavior

#### Layout Components
From CLI `src/components/layout/`:
- `Box.tsx`, `Column.tsx`, `Row.tsx` - Flexbox layouts
- `View.tsx` - Main view container
- `List.tsx` - List rendering with selection
- `AsyncView.tsx` - Loading states and error boundaries

#### Content Components
From CLI `src/components/content/`:
- `Text.tsx` - Styled text rendering
- `Code.tsx` - Syntax-highlighted code blocks
- `Error.tsx` - Error display with details
- `Command.tsx` - Command execution display
- `Search.tsx` - Search interfaces

### Step 3: Extract Theme and Styling System
```typescript
// theme/colors.ts
export const colors = {
  primary: '#0066cc',
  success: '#00aa00', 
  warning: '#ff8800',
  error: '#cc0000',
  muted: '#666666',
  // ... from CLI theme
};

// theme/theme.ts
export interface Theme {
  colors: typeof colors;
  spacing: Record<string, number>;
  typography: Record<string, any>;
}

// providers/ThemeProvider.tsx
export const ThemeProvider: React.FC<{
  theme?: Partial<Theme>;
  children: React.ReactNode;
}> = ({ theme, children }) => {
  // Theme context implementation
};
```

### Step 4: Generalize Component APIs
Make components reusable beyond just the CLI:

```typescript
// Before: CLI-specific
interface ChatProps {
  // Hard-coded CLI state references
}

// After: Generic and reusable
interface ChatProps {
  messages: ChatMessage[];
  onSendMessage: (message: string) => void;
  onToolConfirm: (callId: string, approved: boolean) => void;
  streaming?: boolean;
  streamingContent?: string;
  toolCalls?: ToolCallDisplay[];
  theme?: Partial<Theme>;
}
```

### Step 5: Extract Hooks and Utilities
From CLI `src/hooks/`:
- `useAsyncData.ts` - Async data fetching patterns
- `useChatNavigation.ts` - Chat navigation logic

Create new shared hooks:
```typescript
// hooks/useStreaming.ts
export function useStreaming(onFragment: (text: string) => void) {
  // Streaming text handling
}

// hooks/useToolCalls.ts  
export function useToolCalls(onConfirm: ToolConfirmHandler) {
  // Tool call confirmation logic
}
```

### Step 6: Component Documentation and Examples
Create comprehensive examples for each component:

```typescript
// examples/ChatExample.tsx
export const BasicChatExample = () => (
  <Chat
    messages={exampleMessages}
    onSendMessage={(msg) => console.log('Sent:', msg)}
    onToolConfirm={(id, approved) => console.log('Tool:', id, approved)}
  />
);

export const StreamingChatExample = () => (
  <Chat
    messages={exampleMessages}
    streaming={true}
    streamingContent="This is streaming text..."
    onSendMessage={handleSend}
  />
);
```

### Step 7: Update CLI to Use @sage/ui

1. **Update Dependencies**
   ```json
   {
     "dependencies": {
       "@sage/ui": "workspace:*"
     }
   }
   ```

2. **Replace Component Imports**
   ```typescript
   // Before
   import { Chat } from "./components/chat/Chat.js";
   import { ChatMessage } from "./components/chat/ChatMessage.js";
   
   // After
   import { Chat, ChatMessage } from "@sage/ui";
   ```

3. **Update Component Usage**
   ```typescript
   // Pass state as props instead of using internal context
   <Chat 
     messages={threadState.messages}
     onSendMessage={sendMessage}
     onToolConfirm={handleToolConfirmation}
     streaming={state.turn === "assistant"}
     streamingContent={state.response}
   />
   ```

4. **Clean Up CLI Components**
   - Remove `apps/cli/src/components/` directory
   - Update all component imports
   - Preserve CLI-specific logic in containers

### Step 8: Testing and Documentation

#### Component Testing
```typescript
// tests/Chat.test.tsx
import { render } from '@testing-library/react';
import { Chat } from '../src/components/chat/Chat';

test('renders messages correctly', () => {
  const messages = [
    { role: 'user', content: 'Hello' },
    { role: 'assistant', content: 'Hi there!' }
  ];
  
  const { getByText } = render(
    <Chat messages={messages} onSendMessage={jest.fn()} />
  );
  
  expect(getByText('Hello')).toBeInTheDocument();
  expect(getByText('Hi there!')).toBeInTheDocument();
});
```

#### Storybook Integration
Consider adding Storybook for component development:
```bash
pnpm add -D @storybook/react @storybook/addon-essentials
```

## Files to Change

### New Files
- `packages/ui/` (entire package)
- Component examples and documentation

### Modified Files  
- `apps/cli/package.json` (add @sage/ui dependency)
- All CLI files that import components (update imports)
- `apps/cli/src/views/` (update to use @sage/ui components)

### Deleted Files
- `apps/cli/src/components/` (entire directory moved)
- `apps/cli/src/config/theme.ts` (moved to @sage/ui)

## Risk Mitigation
- **Low Risk**: Components have clean interfaces
- **Medium Risk**: Theme/styling integration
- **Main Risk**: Breaking existing CLI functionality
- **Mitigation**: Gradual migration with extensive visual regression testing

## Dependencies
- `react` and `ink` for UI framework
- CLI dependencies moved to @sage/ui
- Future integration with other SAGE apps

## Success Validation
1. All CLI visual functionality works identically
2. Components render correctly in isolation  
3. Theme system preserves all styling
4. Streaming and tool call UI works perfectly
5. Performance is equivalent or better
6. Components are well-documented with examples

## Future Benefits
- Other SAGE apps can use the same UI components
- Consistent user experience across all interfaces
- Easier to maintain and update visual elements
- Component reusability and testing

## Next Phase
With UI extracted, Phase 4 can implement formal agents that will use these components for user interactions.