# AGENTS.md

This file provides guidance for agentic coding assistants working on this project.

## Build/Test Commands

**Development:**
```bash
bun run dev          # Run the TUI app in development mode
bun run start        # Alias for dev
```

**Building:**
```bash
bun run build        # Build to dist/diffwatch (auto-includes version)
```

**Testing:**
```bash
bun test                    # Run all tests
bun test:watch              # Watch mode for development
bun test:coverage           # Run tests with coverage
bun test:unit               # Run all unit tests (tests/unit/)
bun test:integration        # Run integration tests (tests/integration/)
bun test:git                # Run git utility tests only
bun test:components         # Run component tests only
bun test:app                # Run app integration tests only
```

**Run a single test:**
```bash
bun test tests/unit/git.test.ts
bun test tests/integration/App.test.ts
```

**Type Checking & Linting:**
```bash
bun run typecheck   # TypeScript type checking
bun run lint        # Alias for typecheck
```

## Code Style Guidelines

### Imports
- Use named imports from React: `import { useState, useEffect, useMemo } from 'react'`
- Use named imports from OpenTUI: `import { useRenderer, useKeyboard } from '@opentui/react'`
- Import both functions and types from utility modules: `import { getChangedFiles, type FileStatus } from './utils/git'`
- Use relative imports with `./` or `../` for internal modules
- Use bare imports for external packages: `import simpleGit from 'simple-git'`

### Formatting
- 2-space indentation
- Single quotes for strings
- Semicolons required at end of statements
- Use backticks for template literals
- No trailing whitespace

### Types
- TypeScript strict mode enabled
- Explicitly type function parameters and return values
- Use `type` for type aliases (not `interface` unless needed)
- Union types for string literals: `'modified' | 'new' | 'deleted'`
- Use `any` sparingly; prefer `unknown` or specific types
- Use `Record<string, string>` for simple object maps
- Component props defined as interfaces before the component

### Naming Conventions
- **Components:** PascalCase (`App`, `FileList`, `DiffViewer`)
- **Functions:** camelCase (`getChangedFiles`, `loadContent`, `openFile`)
- **Constants:** UPPER_SNAKE_CASE (`POLLING_INTERVAL`)
- **Variables/Props:** camelCase (`selectedIndex`, `repoPath`, `isBinary`)
- **Interfaces:** PascalCase with descriptive names (`FileStatus`, `FileListProps`)
- **Type exports:** Export types alongside functions for clarity

### Error Handling
- Use try-catch blocks for async operations that may fail
- Return default values instead of throwing for non-critical errors:
  - Git operations: return `[]` for file lists, `'unknown'` for branch
  - File operations: return `''` for content, `false` for boolean checks
- Handle errors gracefully in UI components (show notifications, not crashes)
- Use error instanceof Error to safely extract messages
- Log console.error only when helpful for debugging

### Component Patterns
- Define interfaces for props before component function
- Use hooks at the top of component body
- useEffect cleanup: clear intervals/refs to prevent memory leaks
- Include all dependencies in useEffect dependency arrays
- Use useRef for mutable values that don't trigger re-renders (intervals)
- Separate concerns: state management, effects, and rendering
- Use useMemo for expensive computations
- Use key prop for dynamic lists

### Testing
- Use Bun's test framework: `import { describe, test, expect, mock, beforeEach, afterEach } from 'bun:test'`
- Mock modules at the top with `mock.module()` before imports
- Reset mocks in `beforeEach()` with `mock.restore()`
- Structure tests with `describe()` blocks grouping related functionality
- Write descriptive test names that explain what is being tested
- Test both success and error cases
- Use dependency injection for testing (pass mocked fs/path implementations)
- Test files mirror src structure: `tests/unit/git.test.ts` for `src/utils/git.ts`
- Use `expect().toBe()`, `expect().toEqual()`, `expect().toHaveLength()`, `expect().toHaveBeenCalledWith()`

### React Patterns
- Functional components with hooks (no class components)
- Controlled components with state
- Keyboard handling with `useKeyboard` hook
- Mouse interactions with `onMouseDown`, `onMouseScroll` handlers
- Conditional rendering with ternary operators and `&&`
- Fragment for multiple elements: `<>...</>`
- Use `span` for inline text with color/styling in OpenTUI
- Use `box` for layout containers with flexDirection

### File Organization
- `src/index.tsx` - Entry point
- `src/App.tsx` - Main application component
- `src/components/` - UI components (FileList, DiffViewer, StatusBar, HistoryViewer)
- `src/utils/` - Utility functions (git.ts)
- `src/constants.ts` - Constants
- `tests/unit/` - Unit tests for components and utilities
- `tests/integration/` - Integration tests for the app
- `bin/diffwatch.js` - Executable wrapper for the compiled binary

### Git Operations
- Use `simple-git` library for all git operations
- Handle compound git status strings (e.g., "AD", "AM", "MD")
- Deduplicate files by path when multiple statuses apply
- Sort files by mtime descending, then by filename
- Use `git diff -U3` for consistent diff context
- Use `git grep -i -l -F` for file content search

### Performance
- Poll for git changes every 2 seconds (POLLING_INTERVAL)
- Debounce search operations (300ms timeout)
- Clean up intervals in useEffect return functions
- Use refs to track interval IDs and prevent duplicates
- Lazy load commit history only when history mode is active

### Platform Support
- Windows: Use `spawn('cmd', ['/c', 'start', '""', absPath], { shell: false })`
- macOS: Use `spawn('open', [absPath], { shell: true })`
- Linux: Use `spawn('xdg-open', [absPath], { shell: true })`
- Handle paths with spaces on all platforms
