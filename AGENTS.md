# DiffWatch Agent Guidelines

This document provides coding standards and operational guidelines for agentic coding assistants working on the DiffWatch project.

## Build, Lint, and Test Commands

### Primary Commands
- **Build**: `npm run build` - Compiles TypeScript to JavaScript using `tsc`
- **Test**: `npm test` - Runs Jest test suite
- **Dev**: `npm run dev` - Runs the application in development mode with `ts-node`
- **Start**: `npm start` - Runs the compiled application from `dist/`

### Testing Specific Files
- Run a single test file: `npm test -- tests/git.test.ts`
- Run tests matching a pattern: `npm test -- --testNamePattern="should return file status"`

### Linting and Type Checking
- **Type Check**: `npx tsc --noEmit` - TypeScript type checking without compilation
- **No explicit linting configured** - TypeScript strict mode serves as the primary code quality gate

## Code Style Guidelines

### Language and Module System
- **Language**: TypeScript with strict mode enabled
- **Target**: ES6 JavaScript output
- **Module System**: CommonJS output (`"type": "commonjs"` in package.json)
- **Source**: ES6 modules with `import`/`export` syntax

### Import/Export Style
```typescript
// ES6 imports at the top of files
import { simpleGit, SimpleGit, StatusResult } from 'simple-git';
import fs from 'fs/promises';
import chalk from 'chalk';

// Named exports for utilities
export interface FileStatus {
  path: string;
  status: 'modified' | 'added' | 'deleted' | 'unstaged' | 'unknown' | 'unchanged';
  mtime?: Date;
}

// Default export for main classes
export class GitHandler {
  // ...
}
```

### Naming Conventions
- **Variables/Functions**: camelCase (`filePath`, `getStatus`, `updateFileList`)
- **Classes/Interfaces**: PascalCase (`GitHandler`, `FileStatus`)
- **Constants**: UPPER_CASE (not commonly used in this codebase)
- **Files**: kebab-case for directories (`diff-formatter.ts`), camelCase for utilities
- **Test Files**: Match source filename with `.test.ts` extension (`git.test.ts`)

### Code Structure and Patterns
- **Async/Await**: Preferred over Promises for asynchronous operations
- **Error Handling**: Try-catch blocks with descriptive error messages
- **Type Safety**: Use interfaces for data structures, avoid `any` type
- **Class Design**: Private properties with public methods, constructor injection
- **Functional Programming**: Pure functions where possible, avoid side effects

### Formatting and Style
- **Indentation**: 2 spaces (no tabs)
- **Semicolons**: Not used (TypeScript ASI)
- **Quotes**: Single quotes for strings (`'string'`)
- **Line Length**: No strict limit, break long lines naturally
- **Blank Lines**: Use sparingly between logical code blocks
- **Comments**: Minimal comments, rely on descriptive naming
- **Braces**: Same line for functions/classes, new line for control structures

### Example Code Style
```typescript
export class GitHandler {
  private git: SimpleGit;

  constructor(workingDir: string = process.cwd()) {
    this.git = simpleGit(workingDir);
  }

  async getStatus(): Promise<FileStatus[]> {
    const status: StatusResult = await this.git.status();
    const uniqueFiles = new Map<string, FileStatus>();

    status.modified.forEach(path => {
      uniqueFiles.set(path, { path, status: 'modified' });
    });

    // Process and return sorted results
    const fileArray = Array.from(uniqueFiles.values());
    return fileArray.sort((a, b) => {
      const timeDiff = (b.mtime || new Date(0)).getTime() - (a.mtime || new Date(0)).getTime();
      return timeDiff !== 0 ? timeDiff : a.path.localeCompare(b.path);
    });
  }
}
```

### Error Handling Patterns
```typescript
async getFileContent(filePath: string): Promise<string> {
  try {
    return await fs.readFile(filePath, 'utf8');
  } catch (error) {
    return `Error reading file: ${error}`;
  }
}

async isRepo(): Promise<boolean> {
  try {
    return await this.git.checkIsRepo();
  } catch {
    return false;
  }
}
```

### Testing Guidelines
- **Framework**: Jest with ts-jest for TypeScript support
- **Mocking**: Mock external dependencies (simple-git, fs/promises)
- **Test Structure**: `describe` blocks for classes, `it` blocks for methods
- **Assertions**: Use Jest matchers (`expect().toBe()`, `expect().toEqual()`)
- **Test Naming**: Descriptive sentences starting with "should"
- **Coverage**: Aim for critical path coverage, especially Git operations

```typescript
describe('GitHandler', () => {
  let gitHandler: GitHandler;
  let mockGit: any;

  beforeEach(() => {
    mockGit = { checkIsRepo: jest.fn() };
    (simpleGit as jest.Mock).mockReturnValue(mockGit);
    gitHandler = new GitHandler();
  });

  it('should return true if directory is a repo', async () => {
    mockGit.checkIsRepo.mockResolvedValue(true);
    const result = await gitHandler.isRepo();
    expect(result).toBe(true);
  });
});
```

### File Organization
- **Source Code**: `src/` directory with subdirectories for utilities
- **Tests**: `tests/` directory mirroring source structure
- **Build Output**: `dist/` directory (gitignored)
- **Configuration**: Root level for `package.json`, `tsconfig.json`, `jest.config.js`

### TypeScript Configuration
- **Strict Mode**: Enabled for type safety
- **Source Maps**: Enabled for debugging
- **Declaration Files**: Generated for library usage
- **Module Resolution**: Node.js style
- **ES Module Interop**: Enabled for compatibility

### Dependencies
- **Runtime**: chalk (colors), simple-git (Git operations), neo-neo-blessed (TUI)
- **Dev**: Jest, ts-jest, ts-node, TypeScript
- **Keep dependencies minimal** - only add when necessary for functionality

### Git and Version Control
- **Branching**: Feature branches for development
- **Commits**: Descriptive messages focusing on "why" rather than "what"
- **Tags**: Semantic versioning (current: 1.0.8)
- **Hooks**: No custom hooks configured

### Security Considerations
- **Input Validation**: Validate file paths and user inputs
- **Error Messages**: Avoid exposing sensitive system information
- **Dependencies**: Keep updated, audit regularly
- **Secrets**: Never commit sensitive data

### Performance Guidelines
- **Async Operations**: Use efficient patterns, avoid blocking operations
- **Memory Management**: Clean up resources, avoid memory leaks
- **File I/O**: Handle large files appropriately
- **Real-time Updates**: Debounce rapid operations (150ms in current code)

### Code Review Checklist
- [ ] TypeScript compiles without errors
- [ ] Tests pass and cover new functionality
- [ ] Follows established naming and style conventions
- [ ] Error handling appropriate for use case
- [ ] No console.log statements in production code
- [ ] Dependencies justified and minimal
- [ ] Documentation updated if public API changes</content>
<parameter name="filePath">D:\SystemFolders\Downloads\Dev\node\diffwatch\AGENTS.md