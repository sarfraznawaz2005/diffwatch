# Agent Guidelines for DiffWatch

This file contains guidelines for AI agents working on the DiffWatch codebase.

## Build, Test, and Development Commands

### Running Tests
```bash
bun test                    # Run all tests
bun test:watch            # Run tests in watch mode
bun test:coverage         # Run tests with coverage
bun test:unit            # Run unit tests only
bun test:integration     # Run integration tests only
bun test:git            # Run git-related tests only
bun test:components     # Run component tests only
bun test:app           # Run app integration tests
```

### Running a Single Test
Use Bun's test pattern matching:
```bash
bun test <pattern>        # Run tests matching pattern
bun test git.test.ts      # Run specific test file
bun test -t "test name"   # Run tests matching name
```

### Build & Type Checking
```bash
bun run build            # Build production binary (creates dist/diffwatch.exe)
bun run dev              # Run in development mode
bun run start           # Alias for dev
bun run typecheck       # TypeScript type checking
bun run lint           # Alias for typecheck
```

### Version Management
```bash
bun run build:version   # Generate src/version.ts from package.json (auto-run during build)
```

## Code Style Guidelines

### Imports
- Use named imports for React hooks: `import { useState, useEffect } from 'react';`
- Use named imports from utilities: `import { func1, func2, type Type1 } from './utils/git';`
- Use `import * as module from 'module'` for Node.js modules
- Group imports in this order: React → external libs → local components → local utils

### Formatting
- Use 4-space indentation
- End statements with semicolons
- Use double quotes for strings
- Components use PascalCase: `FileList`, `StatusBar`
- Functions use camelCase: `getChangedFiles`, `runGit`
- Constants use UPPER_SNAKE_CASE: `POLLING_INTERVAL`
- Interfaces use PascalCase: `FileStatusProps`, `FsPromises`

### Type Annotations
- Type all function parameters and return values
- Use interfaces for component props: `interface ComponentProps { }`
- Use `export type` for type aliases
- Use generics with React hooks: `useState<FileStatus[]>([])`
- Leverage strict TypeScript (noImplicitAny, strictNullChecks)

### Components
- Use functional components with hooks
- Destructure props in function signature
- Use TypeScript for prop interfaces
- Use conditional rendering for optional features

### Error Handling
- Use try-catch for async operations
- Handle errors gracefully (don't crash the app)
- Check `error instanceof Error` before accessing `.message`
- Return fallback values for non-critical failures
- Use dependency injection for testing file system operations

### Testing
- Use Bun's test framework: `import { describe, test, expect, mock } from 'bun:test';`
- Mock external dependencies (fs, simple-git) before importing
- Use `describe/test` blocks for organization
- Restore mocks in `beforeEach`: `mock.restore();`
- Test edge cases (empty arrays, missing files, invalid paths)

### File Organization
- `src/App.tsx` - Main application component
- `src/components/*.tsx` - UI components
- `src/utils/*.ts` - Business logic and git operations
- `src/constants.ts` - Application constants
- `tests/unit/*.test.ts` - Unit tests
- `tests/integration/*.test.ts` - Integration tests

### TypeScript Configuration
- Strict mode enabled
- Target ESNext
- React JSX with automatic runtime
- Allow importing TS extensions (for Bun)

## Important Notes

- This is a TUI (Terminal UI) app using @opentui/react
- Real-time polling every 2 seconds (POLLING_INTERVAL)
- All git operations accept optional `cwd` parameter defaulting to `process.cwd()`
- Use dependency injection patterns for testing (FsPromises, Path interfaces)
- The app is built with Bun's compiler into a single executable
- Windows-only currently; Linux/macOS support planned

## Common Tasks

### Adding a New Component
1. Create component in `src/components/`
2. Define props interface with TypeScript
3. Use functional component pattern
4. Export as named export
5. Add tests in `tests/unit/`

### Adding Git Operations
1. Add function to `src/utils/git.ts`
2. Export with type annotations
3. Accept `cwd: string = process.cwd()` parameter
4. Use simple-git for git operations
5. Add unit tests with mocked git

### Adding CLI Flags
1. Update `src/index.tsx` parseArgs() function
2. Add handling for the new flag
3. Update help message in showHelp()
4. Test with `dist/diffwatch.exe --flag`

### Adding Keyboard Shortcuts
1. Update `src/App.tsx` keyboard handling
2. Document in README.md Keyboard Shortcuts section
3. Add to --help output
