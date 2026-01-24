#!/usr/bin/env node
const blessed = require('neo-neo-blessed');
import chalk from 'chalk';
import { spawn } from 'child_process';
import { GitHandler, FileStatus } from './utils/git';
import { formatDiffWithDiff2Html } from './utils/diff-formatter';
import { readFileSync } from 'fs';
import { dirname, join } from 'path';

const packageJson = JSON.parse(readFileSync(join(dirname(__filename), '..', 'package.json'), 'utf-8'));

async function main() {
  const args = process.argv.slice(2);
  let repoPath = process.cwd();

  const showHelp = () => {
    console.log(`
Usage: diffwatch [path] [options]

Arguments:
  path               Path to the git repository (default: current directory)

Options:
  -h, --help         Show help information
  -v, --version      Show version information
    `);
    process.exit(0);
  };

  const showVersion = () => {
    console.log(`diffwatch v${packageJson.version}`);
    process.exit(0);
  };

  const positionalArgs = [];
  for (let i = 0; i < args.length; i++) {
    if (args[i] === '-h' || args[i] === '--help') {
      showHelp();
    } else if (args[i] === '-v' || args[i] === '--version') {
      showVersion();
    } else if (args[i].startsWith('-')) {
      // Ignore unknown flags or handle them if needed
    } else {
      positionalArgs.push(args[i]);
    }
  }

  if (positionalArgs.length > 0) {
    repoPath = positionalArgs[0];
  }

  try {
    process.chdir(repoPath);
  } catch (err) {
    console.error(`Error: Could not change directory to ${repoPath}`);
    process.exit(1);
  }

  const gitHandler = new GitHandler(repoPath);

  if (!(await gitHandler.isRepo())) {
    console.log(chalk.red(`Error: ${repoPath} is not a git repository.`));
    process.exit(1);
  }

  // Force xterm-256color to encourage better mouse support on Windows terminals
  if (process.platform === 'win32' && !process.env.TERM) {
     process.env.TERM = 'xterm-256color';
  }

  const screen = blessed.screen({
    smartCSR: true,
    title: 'diffwatch',
    mouse: true,
  });

  // Explicitly enable mouse tracking
  screen.program.enableMouse();

  let fileList: any = blessed.list({
    top: 0,
    left: 0,
    width: '30%',
    height: '99%',
    label: 'Files (0)',
    keys: true,
    vi: true,
    mouse: true,
    tags: true,
    scrollbar: {
      ch: ' ',
      track: { bg: 'white' },
      style: { bg: 'blue' },
    },
    style: {
      selected: { fg: 'black', bg: 'white' },
      border: { fg: 'white' },
    },
    border: { type: 'line' },
  });

  const createFileList = () => {
    const newList = blessed.list({
      top: 0,
      left: 0,
      width: '30%',
      height: '99%',
      label: 'Files (0)',
      keys: true,
      vi: true,
      mouse: true,
      tags: true,
      scrollbar: {
        ch: ' ',
        track: { bg: 'white' },
        style: { bg: 'blue' },
      },
      style: {
        selected: { fg: 'black', bg: 'white' },
        border: { fg: 'white' },
      },
      border: { type: 'line' },
    });

    newList.on('select item', () => {
      scheduleDiffUpdate();
    });

    newList.key(['up', 'down'], () => {
      scheduleDiffUpdate();
    });

    newList.on('wheeldown', () => handleScroll('down'));
    newList.on('wheelup', () => handleScroll('up'));

    return newList;
  };

  const diffView = blessed.scrollabletext({
    top: 0,
    left: '30%',
    width: '70%',
    height: '99%',
    label: ' Diff () ',
    keys: true,
    vi: true,
    mouse: true,
    scrollbar: {
      ch: ' ',
      track: { bg: 'white' },
      style: { bg: 'blue' },
    },
    style: {
      border: { fg: 'white' },
    },
    border: { type: 'line' },
    tags: false,
  });

  const searchBox = blessed.box({
    top: 'center',
    left: 'center',
    width: '50%',
    height: 3,
    label: ' Search ',
    border: { type: 'line' },
    style: { border: { fg: 'yellow' } },
    hidden: true,
  });

  const searchInput = blessed.textbox({
    parent: searchBox,
    top: 0,
    left: 0,
    width: '100%-2',
    height: 1,
    keys: true,
    inputOnFocus: true,
    style: { fg: 'white', bg: 'black' },
  });

  // Confirmation dialog for revert
  const confirmDialog = blessed.box({
    top: 'center',
    left: 'center',
    width: '38%',
    label: ' Confirm Revert ',
    height: 3,
    content: 'Press SPACE key to confirm revert or ESC to cancel.',
    border: { type: 'line' },
    style: {
      fg: 'yellow',
      bg: 'black',
      border: { fg: 'yellow' }
    },
    hidden: true,
  });

  const notificationBox = blessed.box({
    top: 'center',
    left: 'center',
    width: '50%',
    height: 3,
    label: ' Notification ',
    border: { type: 'line' },
    style: {
      fg: 'green',
      bg: 'black',
      border: { fg: 'green' }
    },
    hidden: true,
  });

  const showNotification = (message: string, color: 'green' | 'red' = 'green') => {
    notificationBox.setContent(message);
    notificationBox.style = {
      fg: color,
      bg: 'black',
      border: { fg: color }
    };
    notificationBox.show();
    notificationBox.setFront();
    screen.render();

    setTimeout(() => {
      notificationBox.hide();
      fileList.focus();
      screen.render();
    }, 3000);
  };

  // Branch display in bottom right
  const branchBox = blessed.box({
    bottom: 0,
    right: 0,
    width: 'shrink',
    height: 1,
    align: 'left',
    content: chalk.cyan('Branch: '),
    style: {
      fg: 'white',
    },
  });

  // Footer box to show shortcuts - aligned with the panes
  const footer = blessed.box({
    bottom: 0,
    left: 0,
    width: '100%',
    height: 1,
    content: chalk.green('←→') + ' Switch |' + chalk.green(' ⏎') + ' Open | ' + chalk.green('S') + ' Search | ' + chalk.green('R') + ' Revert | ' + chalk.green('Q') + ' Quit ',
  });

  screen.append(fileList);
  screen.append(diffView);
  screen.append(searchBox);
  screen.append(notificationBox);
  screen.append(confirmDialog);
  screen.append(footer);
  screen.append(branchBox);

  const updateBorders = () => {
    fileList.style.border.fg = screen.focused === fileList ? 'yellow' : 'white';
    diffView.style.border.fg = screen.focused === diffView ? 'yellow' : 'white';
    screen.render();
  };

  let currentFiles: FileStatus[] = [];
  let lastSelectedPath: string | null = null;
  let diffUpdateTimeout: NodeJS.Timeout | null = null;
  let currentSearchTerm: string = '';
  let currentBranch: string = '';
  let lastFilePaths: string[] = [];
  let isUpdatingList = false;

  const scheduleDiffUpdate = () => {
    if (diffUpdateTimeout) clearTimeout(diffUpdateTimeout);
    diffUpdateTimeout = setTimeout(async () => {
      await updateDiff();
    }, 150); // 150ms debounce
  };

  const handleScroll = (direction: 'up' | 'down') => {
    const focused = screen.focused;
    if (focused === fileList) {
      if (direction === 'up') {
        focused.up(1);
      } else {
        focused.down(1);
      }
      scheduleDiffUpdate();
      screen.render();
    } else if (focused === diffView) {
      const scrollAmount = direction === 'up' ? -2 : 2;
      diffView.scroll(scrollAmount);
      screen.render();
    }
  };

  // Remove default wheel listeners to enforce "scroll focused only" behavior
  fileList.removeAllListeners('wheeldown');
  fileList.removeAllListeners('wheelup');
  diffView.removeAllListeners('wheeldown');
  diffView.removeAllListeners('wheelup');

  // Attach custom scroll handlers to widgets (captures wheel even if hovering specific widget)
  // We use widget-level listeners now that screen.mouse is true.
  // We attach to both to ensure the event is caught regardless of where the mouse is.
  // We use widget-level listeners now that screen.mouse is true.
  // We attach to both to ensure the event is caught regardless of where the mouse is.
  // The handleScroll function will then decide WHAT to scroll based on focus.

  diffView.on('wheeldown', () => handleScroll('down'));
  diffView.on('wheelup', () => handleScroll('up'));

  // Also listen on screen for events that might miss the widgets (margins, borders)
  screen.on('wheeldown', () => handleScroll('down'));
  screen.on('wheelup', () => handleScroll('up'));

  const openInEditor = (filePath: string) => {
    try {
      if (process.platform === 'win32') {
        // On Windows, use 'start' to open with default program
        spawn('cmd', ['/c', 'start', '', filePath], { stdio: 'ignore', detached: true }).unref();
      } else {
        // On Unix-like systems, try EDITOR, fallback to xdg-open
        const editor = process.env.EDITOR || process.env.VISUAL || 'xdg-open';
        spawn(editor, [filePath], { stdio: 'ignore', detached: true }).unref();
      }
    } catch (error) {
      console.error(`Failed to open ${filePath}: ${error}`);
    }
  };

  const updateBranch = async () => {
    const branch = await gitHandler.getBranch();
    if (branch !== currentBranch) {
      currentBranch = branch;
      branchBox.setContent(chalk.cyan('Branch: ') + chalk.yellow(branch));
      screen.render();
    }
  };

  const updateDiff = async () => {
    const selectedIndex = fileList.selected;
    const selectedFile = currentFiles[selectedIndex];
    if (!selectedFile) {
      // No valid file selected, clear diff view
      diffView.setContent('Select a file to view diff.');
      diffView.setLabel(' Diff () ');
      lastSelectedPath = null;
      screen.render();
      return;
    }
    if (selectedFile) {
      let content = '';
      let label = ` Diff (${selectedFile.path}) `;

      if (selectedFile.status !== 'unchanged' && selectedFile.status !== 'deleted') {
        const diff = await gitHandler.getDiff(selectedFile.path);
        content = formatDiffWithDiff2Html(diff, currentSearchTerm);
      }

      if (!content && selectedFile.status !== 'deleted') {
        content = await gitHandler.getFileContent(selectedFile.path);
        // Highlight search term in full content
        if (currentSearchTerm) {
          const regex = new RegExp(`(${currentSearchTerm.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi');
          content = content.replace(regex, `\x1b[43m\x1b[30m$1\x1b[0m`);
        }
        label = ` File (${selectedFile.path}) `;
      } else if (!content && selectedFile.status === 'deleted') {
        content = chalk.red('File was deleted.');
        label = ` Diff (${selectedFile.path}) `;
      }

      const currentContent = diffView.content;
      const currentLabel = diffView.label;

      // Only update if content or label changed to reduce flickering
      if (content !== currentContent || label !== currentLabel) {
        const savedScroll = diffView.scrollTop;
        const isNewFile = selectedFile.path !== lastSelectedPath;

        diffView.setContent(content);
        diffView.setLabel(label);

        if (isNewFile) {
          diffView.scrollTo(0);
        } else {
          diffView.scrollTop = savedScroll;
        }
      }
      lastSelectedPath = selectedFile.path;
    } else {
      const newContent = 'Select a file to view diff.';
      const newLabel = ' Diff () ';
      if (diffView.content !== newContent || diffView.label !== newLabel) {
        diffView.setContent(newContent);
        diffView.setLabel(newLabel);
        diffView.scrollTo(0);
      }
      lastSelectedPath = null;
    }
    screen.render();
  };

  const updateFileList = async () => {
    if (isUpdatingList) return;
    isUpdatingList = true;

    const selectedPath = currentFiles[fileList.selected]?.path;

    let files: FileStatus[];

    if (currentSearchTerm) {
      files = await gitHandler.searchFiles(currentSearchTerm);
    } else {
      files = await gitHandler.getStatus();
    }

    currentFiles = files;

    const items = files.map((f) => {
      let color = '{white-fg}';
      if (f.status === 'added') color = '{green-fg}';
      else if (f.status === 'deleted') color = '{red-fg}';
      else if (f.status === 'modified') color = '{blue-fg}';
      else if (f.status === 'unstaged') color = '{white-fg}';
      else if (f.status === 'unchanged') color = '{grey-fg}';

      return `${color}${f.path}{/}`;
    });

    const labelTitle = currentSearchTerm ? `Files (${files.length}) - Searching: "${currentSearchTerm}"` : `Files (${files.length})`;

    const newFilePaths = files.map(f => f.path);
    const selectedFileStillExists = selectedPath ? newFilePaths.includes(selectedPath) : false;
    const listChanged = lastFilePaths.length !== newFilePaths.length ||
                       lastFilePaths.some(path => !newFilePaths.includes(path)) ||
                       newFilePaths.some(path => !lastFilePaths.includes(path));

    if (items.length > 0) {
      const newSelectedIndex = selectedPath ? currentFiles.findIndex(f => f.path === selectedPath) : -1;

      const oldFileList = fileList;
      const newFileList = createFileList();
      newFileList.setLabel(labelTitle);
      newFileList.setItems(items);
      newFileList.select(newSelectedIndex >= 0 ? newSelectedIndex : 0);

      if (!selectedFileStillExists || listChanged) {
        lastSelectedPath = null;
      }

      lastFilePaths = newFilePaths;

      if (diffUpdateTimeout) {
        clearTimeout(diffUpdateTimeout);
        diffUpdateTimeout = null;
      }
      await updateDiff();

      oldFileList.destroy();
      screen.remove(oldFileList);
      fileList = newFileList;
      screen.append(fileList);
    } else {
      const oldFileList = fileList;
      const newFileList = createFileList();
      newFileList.setLabel(labelTitle);
      newFileList.setItems([]);

      diffView.setContent(currentSearchTerm ? `No files match "${currentSearchTerm}".` : 'No changes detected.');
      diffView.setLabel(' Diff () ');
      lastSelectedPath = null;
      lastFilePaths = [];

      oldFileList.destroy();
      screen.remove(oldFileList);
      fileList = newFileList;
      screen.append(fileList);
    }

    screen.render();
    isUpdatingList = false;
  };

  screen.key(['escape', 'q', 'C-c'], () => {
    if (!searchBox.hidden) {
      searchBox.hide();
      screen.render();
      fileList.focus();
    } else if (!confirmDialog.hidden) {
      // Close the confirmation dialog if it's open
      confirmDialog.hide();
      fileList.focus();
      screen.render();
    } else {
      screen.destroy();
      process.exit(0);
    }
  });

  screen.key(['s'], () => {
    searchBox.show();
    searchBox.setFront();
    searchInput.setValue(currentSearchTerm);
    searchInput.focus();
    screen.render();
  });

  searchInput.on('submit', async (value: string) => {
    currentSearchTerm = (value || '').trim();
    searchBox.hide();
    fileList.focus();
    // Force immediate update
    await updateFileList();
  });

  searchInput.on('cancel', () => {
    searchBox.hide();
    fileList.focus();
    screen.render();
  });

  screen.key(['tab'], () => {
    if (screen.focused === fileList) {
      diffView.focus();
    } else {
      fileList.focus();
    }
    updateBorders();
  });

  screen.key(['left'], () => {
    if (screen.focused !== fileList) {
      fileList.focus();
      updateBorders();
    }
  });

  screen.key(['right'], () => {
    if (screen.focused !== diffView) {
      diffView.focus();
      updateBorders();
    }
  });

  screen.key(['enter'], () => {
    const selectedIndex = fileList.selected;
    const selectedFile = currentFiles[selectedIndex];
    if (selectedFile) {
      openInEditor(selectedFile.path);
    }
  });

  // Handle revert key press
  screen.key(['r'], async () => {
    const selectedIndex = fileList.selected;
    const selectedFile = currentFiles[selectedIndex];
    if (selectedFile) {
      confirmDialog.setContent(`Press SPACE key to confirm revert or ESC to cancel.`);
      confirmDialog.show();
      confirmDialog.focus();
      screen.render();
    }
  });

  // Handle confirmation dialog response with SPACE key
  confirmDialog.key(['space'], async () => {
    confirmDialog.hide();

    const selectedIndex = fileList.selected;
    const selectedFile = currentFiles[selectedIndex];
    if (selectedFile) {
      try {
        await gitHandler.revertFile(selectedFile.path);
        showNotification(`File ${selectedFile.path} reverted successfully.`, 'green');
        await updateFileList();
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        showNotification(`Error reverting file: ${errorMessage}`, 'red');
      }
    }
    fileList.focus();
  });

  // Handle cancellation with ESC key
  confirmDialog.key(['escape', 'q'], () => {
    confirmDialog.hide();
    fileList.focus();
    screen.render();
  });

  setInterval(async () => {
    await updateFileList();
    await updateBranch();
  }, 5000);

  await updateBranch();
  await updateFileList();
  fileList.focus();
  updateBorders();
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
